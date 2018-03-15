const Logger = require('../../logger');
const AppContext = require('../../AppContext');

const R = require('./collaborativelistening/Raa1UserManager');
const Raa1UserManager = R.Raa1UserManager;

const program = require('commander');
const path = require('path');
const fs = require('fs');
const express = require('express');

class Raa1InternalAPI extends AppContext {
    constructor(program) {
        super();

        this._confFilePath = program.args[0];

        this._productionMode = process.env.NODE_ENV == 'production' ? true : false;

        this._cwd = __dirname;

        let myName = path.basename(__filename, '.js');
        this._logger = new Logger(this._cwd + '/run/logs/' + myName + '.log');

        this._webApp = express();
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
                this._conf.CollaborativeListening.FeedDBFile,
                this._conf.CollaborativeListening.FeedHistoryDBFile
            );

            this._userManager.init(this._conf.Credentials);

            this.registerAPI();

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

        process.exit();
    }

    registerAPI() {
        let self = this;

        this._webApp.post('/notifyAllUsersWithMessage', (req, res) => {
            let message = req.query['message'];
            // We want our api to return immediately, so create another promise
            new Promise((resolve, reject) => {
                try {
                    self.UserManager.notifyAllUsers(
                        message,
                        null,
                        null,
                        'Live'
                    );
                    resolve();
                } catch (error) {
                    AppContext.getInstance().Logger.error(error.stack);
                    reject(error);
                }
            });
            res.send();
        });

        this._webApp.use((err, req, res, next) => {
            AppContext.getInstance().Logger.error(err.stack);
            res
                .status(500)
                .send(
                    'Oops! We cannot think of anything right now.' +
                        'Please come back later'
                );
        });
        this._webApp.listen(this._conf.InternalAPIPort, () => {
            AppContext.getInstance().Logger.info(
                'Raa internal API started on port ' + this._conf.InternalAPIPort
            );
        });
    }

    get UserManager() {
        return this._userManager;
    }
}

/* === Entry Point === */
program.version('1.0.0').parse(process.argv);

if (program.args.length < 1) {
    console.log(
        'Usage: [NODE_ENV=production] node raa1-internal-api.js {config-file}'
    );
    process.exit(1);
}

new Raa1InternalAPI(program).init();
