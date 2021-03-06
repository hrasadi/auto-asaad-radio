const Logger = require('../../logger');
const AppContext = require('../../AppContext');

const UF = require('./collaborativelistening/Raa1PublicFeed');
const Raa1PublicFeed = UF.Raa1PublicFeed;

const SF = require('./collaborativelistening/Raa1PersonalFeed');
const Raa1PersonalFeed = SF.Raa1PersonalFeed;

const R = require('./collaborativelistening/Raa1UserManager');
const Raa1UserManager = R.Raa1UserManager;

const program = require('commander');
const path = require('path');
const fs = require('fs');

class Raa1CLWatcher extends AppContext {
    constructor(program) {
        super();

        this._confFilePath = program.args[0];

        this._productionMode = (process.env.NODE_ENV == 'production') ? true : false;

        this._cwd = __dirname;

        let myName = path.basename(__filename, '.js');
        this._logger = new Logger(this._cwd + '/run/logs/' + myName + '.log');
    }

    init() {
        try {
            try {
                this._conf = JSON.parse(fs.readFileSync(this._confFilePath));
            } catch (e) {
                this.Logger.error('Error parsing config file. Inner exception is: ' + e);
                process.exit(1);
            }
            // User manager
            this._userManager = new Raa1UserManager(
                this._conf.CollaborativeListening.UserDBFile,
            );
            // Feeds
            this._publicFeed = new Raa1PublicFeed(
                this._conf.CollaborativeListening.FeedDBFile,
                this._conf.CollaborativeListening.FeedHistoryDBFile
            );

            this._personalFeed = new Raa1PersonalFeed(
                this._conf.CollaborativeListening.FeedDBFile,
                this._conf.CollaborativeListening.FeedHistoryDBFile
            );

            this._userManager.init(this._conf.Credentials);

            this._publicFeed.init();
            this._publicFeedWatcher = this._publicFeed.getWatcher();
            this._publicFeedWatcher.init();

            this._personalFeed.init();
            this._personalFeedWatcher = this._personalFeed.getWatcher();
            this._personalFeedWatcher.init();

            this.Logger.info('CollaborationListening watcher daemon initiated!');

            process.on('SIGINT', () => this.shutdown());
            process.on('warning', (e) => console.warn(e.stack));
            process.on('unhandledRejection', (e) => console.log(e));
        } catch (error) {
            this._logger.error('Uncaught Error: ' + error.stack);
            process.exit(0);
        }
    }

    shutdown() {
        this._logger.info('Signal received. Shutting down...');

        // Wait for any incomplete work
        this.UserManager.shutdown();
        this.PublicFeed.shutdown();
        this.PersonalFeed.shutdown();

        process.exit();
    };

    get PublicFeed() {
        return this._publicFeed;
    }

    get PersonalFeed() {
        return this._personalFeed;
    }

    get UserManager() {
        return this._userManager;
    }
}

/* === Entry Point === */
program
    .version('1.0.0')
    .parse(process.argv);

if (program.args.length < 1) {
    console.log('Usage: [NODE_ENV=production] node raa1-cl-watcher.js ' +
                '{config-file}');
    process.exit(1);
}

new Raa1CLWatcher(program).init();
