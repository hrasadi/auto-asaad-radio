const Logger = require('../../../logger');
const AppContext = require('../../../AppContext');

const program = require('commander');
const path = require('path');
const fs = require('fs');

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

        this._productionMode = process.env.NODE_ENV == 'production' ? true : false;

        this._cwd = __dirname;

        let myName = path.basename(__filename, '.js');
        this._logger = new Logger(this._cwd + '/run/logs/' + myName + '.log');
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
                console.log(program);
            }
        }
        // 4- Merge with current archive
        // 5- Add handle to program directory if needed
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
                for (let program of box.Programs) {
                    if (program.Id === this._programName) {
                        return program;
                    }
                }
            }
        }
        return null;
    }
}

/* === Entry Point === */
program.version('1.0.0').parse(process.argv);

if (program.args.length < 3) {
    console.log(
        'Usage: [NODE_ENV=production] node migrate-program-archive.js '+
                    '{old-lineups-path} {program-name} {config-file}'
    );
    process.exit(1);
}

new Raa1ProgramMigrator(program).init();
