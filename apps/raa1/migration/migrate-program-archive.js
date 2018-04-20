const Logger = require('../../../logger');
const AppContext = require('../../../AppContext');

const Raa1ArchivePublisher = require('../publishers/Raa1ArchivePublisher');
const Raa1ClipPublisher = require('../publishers/Raa1ClipPublisher');

const LiquidsoapProgram = require('../../../liquidsoap/LiquidsoapProgram');

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
class Raa1ProgramMigrator extends AppContext {
    constructor(program) {
        super();

        this._oldLineupsPath = program.args[0];
        this._programName = program.args[1];
        this._confFilePath = program.args[2];
        this._pinfoDirectoryFilePath = program.args[3];

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
        // We do the following:
        // 1- Open all lineup files (in order of creation)
        let oldLineupFilesPaths = this.listOldLineupFiles();
        // 2- Look for the appearance of the given program (but not replays)
        for (let lineupFilePath of oldLineupFilesPaths) {
            let program = this.checkProgramAired(lineupFilePath);
            if (program) {
                // 3- Add it to archive (only if) it is not already added
                this.publishProgramToArchive(program);
            }
        }
        // 4- Merge with current archive
        // 5- Add handle to program directory if needed
        // TODO: commit
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

    checkProgramAired(lineupFilePath) {
        let lineup = JSON.parse(fs.readFileSync(lineupFilePath, 'utf-8'));
        if (!lineup.Boxes) { // lineup V1
            for (let program of lineup.Programs) {
                if (program.Id === this._programName) {
                    return program;
                }
            }
        } else { // lineup V2
            for (let box of lineup.Boxes) {
                if (box.BoxId) { // Normal box
                    for (let program of box.Programs) {
                        if (program.Id === this._programName) {
                            return program;
                        }
                    }
                } else { // standalone program
                    if (box.Id === this._programName) {
                        return box; // This is actually a program!
                    }
                }
            }
        }
        return null;
    }

    publishProgramToArchive(program) {
        // Build a program in V3 format
        let programToPublish = new LiquidsoapProgram();

        programToPublish.Id = program.Id;
        programToPublish.Title = program.Title;

        // infer Subtitle
        programToPublish._subtitle = '';
        if (program.PreShow) {
            program._subtitle += program.PreShow.Clips.map(
                (clip) => clip.Description
            ).join('؛ ') + '؛ ';
        }
        programToPublish._subtitle += program.Clips.map(
            (clip) => clip.Description
        ).filter((description) => {
            if (description) { // filter out nulls
                return true;
            }
            return false;
        }).join('؛ ');


        if (this.PreShow) {
            let preshowPublicClip =
                this._clipPublisher.getPublicClip(program.PreShow.Clips, 'MainClip');
            programToPublish.PreShow.Clips = [preshowPublicClip];

            if (program.PreShow.FillerClip) {
                let preshowPublicFillerClip =
                    this._clipPublisher.getPublicClip(
                        [program.PreShow.FillerClip],
                        'MainClip'
                    );
                programToPublish.PreShow.FillerClip = preshowPublicFillerClip;
            }
        }

        let actualPublishDate = moment(program.StartTime).format('YYYY-MM-DD');

        let showPublicClip = this._clipPublisher.getPublicClip(
            program.Show.Clips,
            'MainClip'
        );
        programToPublish.Show.Clips = [showPublicClip];

        this._archivePublisher.publish(
            programToPublish,
            actualPublishDate
        );
    }
}

/* === Entry Point === */
program.version('1.0.0').parse(process.argv);

if (program.args.length < 3) {
    console.log(
        'Usage: [NODE_ENV=production] node migrate-program-archive.js ' +
        '{old-lineups-path} {program-name} {config-file} {pinfo-directory-file-path}'
    );
    process.exit(1);
}

new Raa1ProgramMigrator(program).init();
