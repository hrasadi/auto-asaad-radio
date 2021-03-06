const AppContext = require('../../../AppContext');

const RollingList = require('../../../publishers/RollingList');
const ArchivePublisher = require('../../../publishers/ArchivePublisher');

const fs = require('fs');

class Raa1ArchivePublisher extends ArchivePublisher {
    constructor() {
        super();

        this._archiveParentFilePath =
                        AppContext.getInstance().CWD + '/run/archive/raa1-archive.json';

        if (fs.existsSync(this._archiveParentFilePath)) {
            this._programDictionary = JSON.parse(
                    fs.readFileSync(this._archiveParentFilePath));
        } else {
            this._programDictionary = {};
        }
    }

    doPublish(program, targetDate) {
        if (!this._programDictionary[program.ProgramId]) {
            this._programDictionary[program.ProgramId] =
                                    program.ProgramId + '.json';
        }

        if (!this._rollingListsDict[program.ProgramId]) {
            this._rollingListsDict[program.ProgramId] =
                    new RollingList(program.ProgramId,
                                        AppContext.getInstance().CWD + '/run/archive/',
                                        'unlimited', false, (program) =>
                                                program.Show.Clips[0].Media.Path);
        }

        this._rollingListsDict[program.ProgramId].addItem(program, targetDate);
    }

    commit(targetDate) {
        fs.writeFileSync(this._archiveParentFilePath,
            JSON.stringify(this._programDictionary, null, 2));

        for (let program in this._rollingListsDict) {
            if (this._rollingListsDict.hasOwnProperty(program)) {
                this._rollingListsDict[program].flush();
                // We also publish our archives in the form of RSS
                this.generateRSS(program, targetDate, 'SingleProgram');
            }
        }
    }
}

module.exports = Raa1ArchivePublisher;
