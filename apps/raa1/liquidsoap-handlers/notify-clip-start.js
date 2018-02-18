const AppContext = require('../../../AppContext');
const Logger = require('../../../logger');

const R = require('../collaborativelistening/Raa1UserManager');
const Raa1UserManager = R.Raa1UserManager;
const RequiredNotificationPermission = R.RequiredNotificationPermission;

const path = require('path');
const fs = require('fs');

class LiveProgramNotifier extends AppContext {
    constructor(cwd) {
        super();

        this._productionMode = (process.env.NODE_ENV == 'production') ? true : false;
        this._cwd = cwd;

        this._confFilePath = this._cwd + '/conf/raa1-cl.conf';

        let myName = path.basename(__filename, '.js');
        this._logger = new Logger(this._cwd + '/run/logs/' + myName + '.log');
    }

    async init() {
        try {
            this._conf = JSON.parse(fs.readFileSync(this._confFilePath));
        } catch (e) {
            this.Logger.error('Error parsing config file. Inner exception is: ' + e);
            process.exit(1);
        }
        this._userManager = new Raa1UserManager(
            this._conf.CollaborativeListening.FeedDBFile,
            this._conf.CollaborativeListening.FeedHistoryDBFile
        );

        await this._userManager.init(this._conf.Credentials);
    }

    shutdown() {
        this.UserManager.shutdown();
    };

    get UserManager() {
        return this._userManager;
    }
}

async function perform(cwd, liveStatus) {
    let notifier = new LiveProgramNotifier(cwd);
    await notifier.init();

    let message = 'در حال پخش زنده: ' + liveStatus.StartedProgramTitle;
    await notifier.UserManager.notifyAllUsers(
        message,
        null,
        RequiredNotificationPermission.Live
    );
    notifier.shutdown();
}

module.exports = perform;
