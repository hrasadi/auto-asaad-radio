const Logger = require('../../../logger');
const LineupGenerator = require('../../../LineupGenerator');

const Raa1ArchivePublisher = require('../publishers/Raa1ArchivePublisher');
const Raa1ClipPublisher = require('../publishers/Raa1ClipPublisher');

const LiquidsoapProgram = require('../../../liquidsoap/LiquidsoapProgram');
const LiquidsoapMedia = require('../../../liquidsoap/LiquidsoapMedia');

const Show = require('../../../entities/Show').Show;
const Clip = require('../../../entities/Clip').Clip;

const ObjectBuilder = require('../../../entities/ObjectBuilder');

const ProgramInfoDirectory =
    require('../../../entities/programinfo/ProgramInfoDirectory');

const program = require('commander');
const path = require('path');
const fs = require('fs');
const moment = require('moment');

/**
 * This script extracts all episodes from a given program from radio V1 and
 * builds/rebuilds archive entries for it. Also updates the program directory
 */
class Raa1ProgramMigrationLineupGenerator extends LineupGenerator {
    constructor(program) {
        super();

        this._oldLineupsPath = program.args[0];
        this._programName = program.args[1];
        this._confFilePath = program.args[2];
        this._pinfoDirectoryFilePath = program.args[3];
        this._migrateUntilDate = program.args[4];

        this._productionMode = process.env.NODE_ENV == 'production' ? true : false;

        this._cwd = path.join(__dirname, '..');

        let myName = path.basename(__filename, '.js');
        this._logger = new Logger(this._cwd + '/run/logs/' + myName + '.log');

        try {
            this._conf = JSON.parse(fs.readFileSync(this._confFilePath));
        } catch (e) {
            this.Logger.error('Error parsing config file. Inner exception is: ' + e);
            process.exit(1);
        }

        this._objectBuilder = new ObjectBuilder({
            Program: LiquidsoapProgram,
            Media: LiquidsoapMedia,
        });


        this._archivePublisher = new Raa1ArchivePublisher();
        this._clipPublisher = new Raa1ClipPublisher(this._conf.Credentials);
        try {
            this._pinfoDirectory = new ProgramInfoDirectory(
                JSON.parse(fs.readFileSync(this._pinfoDirectoryFilePath))
            );
        } catch (e) {
            this.Logger.error(
                'Error parsing program info directory file.' +
                ' Inner exception is: ' +
                e.stack
            );
            process.exit(1);
        }
    }

    init() {
        this._lineupManager.init(this._conf.LineupTemplate);

        // We do the following:
        // 1- Open all lineup files (in order of creation)
        let oldLineupFilesPaths = this.listOldLineupFiles();
        // 2- Look for the appearance of the given program (but not replays)
        for (let lineupFilePath of oldLineupFilesPaths) {
            let airing = this.findProgramAired(lineupFilePath);
            if (airing) {
                // 3- Add it to archive (only if) it is not already added
                this.publishProgramToArchive(airing);
            }
        }
        // 4- Commit changes
        this._archivePublisher.commit(moment().format('YYYY-MM-DD'));
    }

    listOldLineupFiles() {
        let lineupFilePaths = [];
        let fileNames = fs.readdirSync(this._oldLineupsPath);
        for (let fileName of fileNames) {
            if (fileName.match(/.*\.json$/i)) {
                lineupFilePaths.push(path.join(this._oldLineupsPath, fileName));
            }
        }
        return lineupFilePaths.sort();
    }

    findProgramAired(lineupFilePath) {
        // extract publish date from lineup name
        let matches = (/.*-([0-9]{4})-([0-9]{2})-([0-9]{2})\.json$/g)
                                                        .exec(lineupFilePath);
        let lineupDate = matches[1] + '-' + matches[2] + '-' + matches[3];

        if (moment(lineupDate).isSameOrAfter(moment(this._migrateUntilDate))) {
            // Not our concern
            return null;
        }

        let lineup = JSON.parse(fs.readFileSync(lineupFilePath, 'utf-8'));
        if (!lineup.Boxes) { // lineup V1
            for (let program of lineup.Programs) {
                if (program.Id === this._programName) {
                    return {'box': null, 'program': program, 'lineupDate': lineupDate};
                }
            }
        } else { // lineup V2
            for (let box of lineup.Boxes) {
                if (box.BoxId) { // Normal box
                    for (let program of box.Programs) {
                        if (program.Id === this._programName) {
                            return {'box': box, 'program': program,
                                            'lineupDate': lineupDate};
                        }
                    }
                } else { // standalone program
                    if (box.Id === this._programName) {
                        // This is actually a program!
                        return {'box': null, 'program': box, 'lineupDate': lineupDate};
                    }
                }
            }
        }
        return null;
    }

    publishProgramToArchive(airing) {
        // create V3 program
        let programToPublish = new LiquidsoapProgram();

        let actualPublishDate = airing.lineupDate;

        // Rebuild the canonicalIdPath
        let canonicalIdPath = actualPublishDate + '/';
        if (airing.box) {
            canonicalIdPath += airing.box.BoxId + '/';
        }
        canonicalIdPath += airing.program.Id;

        programToPublish.ProgramId = airing.program.Id;
        programToPublish.Title = airing.program.Title;
        programToPublish.Show = new Show();

        programToPublish.CanonicalIdPath = canonicalIdPath;

        // infer Subtitle
        programToPublish._subtitle = '';
        if (airing.program.PreShow) {
            programToPublish._subtitle += airing.program.PreShow.Clips.map(
                (clip) => clip.Description
            ).join('؛ ') + '؛ ';
        }
        programToPublish._subtitle += airing.program.Show.Clips.map(
            (clip) => clip.Description
        ).filter((description) => {
            if (description) { // filter out nulls
                return true;
            }
            return false;
        }).join('؛ ');


        if (this.PreShow) {
            this._logger.error('Hey!! Why are we migrating a program with prewshow?');
        }

        let showClips = airing.program.Show.Clips.map((clip) => {
            let v3Clip = new Clip();

            let v3Media = new LiquidsoapMedia(null, v3Clip);
            v3Media.Path = clip.Path;
            v3Media.Description = clip.Description;

            v3Clip.Media = v3Media;

            return v3Clip;
        });

        let showPublicClip = this._clipPublisher.getPublicClip(
            showClips,
            'MainClip'
        );
        programToPublish.Show.Clips = [showPublicClip];

        this._archivePublisher.publish(
            programToPublish,
            actualPublishDate
        );

        return programToPublish;
    }
}

/* === Entry Point === */
program.version('1.0.0').parse(process.argv);

if (program.args.length < 4) {
    console.log(
        'Usage: [NODE_ENV=production] node migrate-program-archive.js ' +
        '{old-lineups-path} {program-name} {config-file} {pinfo-directory-file-path} ' +
        '{migrate-until-date}'
    );
    process.exit(1);
}

new Raa1ProgramMigrationLineupGenerator(program).init();
