const AppContext = require('../../../AppContext');

const LiveLineupPublisher = require('../../../publishers/LiveLineupPublisher');
const RollingList = require('../../../publishers/RollingList');

const DateUtils = require('../../../DateUtils');

class Raa1LiveLineupPublisher extends LiveLineupPublisher {
    constructor() {
        super();
        this._feedName = 'live-broadcast';
    }

    doPublish(program, targetDate) {
        // push program in rolling lineup
        if (!this._rollingListsDict[this._feedName]) {
            this._rollingListsDict[this._feedName] =
                    new RollingList(this._feedName,
                                    AppContext.getInstance().CWD + '/run/live/',
                                    'unlimited');
        }

        this._rollingListsDict[this._feedName].addItem(program, targetDate);
    }

    commit(vodTargetDate) {
        // We overwrite the target date to the current date
        let targetDate = DateUtils.getTodayString();
        for (let feedName in this._rollingListsDict) {
            if (this._rollingListsDict.hasOwnProperty(feedName)) {
                this._rollingListsDict[feedName].flush(targetDate);
            }
        }
    }
}

module.exports = Raa1LiveLineupPublisher;
