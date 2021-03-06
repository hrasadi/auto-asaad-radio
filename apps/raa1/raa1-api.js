const Logger = require('../../logger');
const AppContext = require('../../AppContext');

const UF = require('./collaborativelistening/Raa1PublicFeed');
const Raa1PublicFeed = UF.Raa1PublicFeed;

const SF = require('./collaborativelistening/Raa1PersonalFeed');
const Raa1PersonalFeed = SF.Raa1PersonalFeed;

const ProgramInfoDirectory = require('../../entities/programinfo/ProgramInfoDirectory');

const R = require('./collaborativelistening/Raa1UserManager');
const Raa1UserManager = R.Raa1UserManager;
const U = require('../../collaborativelistening/UserManager');
const User = U.User;

const LineupManager = require('../../LineupManager');

const ObjectBuilder = require('../../entities/ObjectBuilder');

const Raa1StartTimeCalculatorManager =
                require('./starttimecalculator/Raa1StartTimeCalculatorManager');

const LiquidsoapBox = require('../../liquidsoap/LiquidsoapBox');
const LiquidsoapProgram = require('../../liquidsoap/LiquidsoapProgram');
const LiquidsoapMedia = require('../../liquidsoap/LiquidsoapMedia');

const program = require('commander');
const path = require('path');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');

class Raa1API extends AppContext {
    constructor(program) {
        super();

        this._confFilePath = program.args[0];
        this._pInfoDirectoryFilePath = program.args[1];

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
                this._pInfoDirectoryString = JSON.stringify(
                    new ProgramInfoDirectory(
                        JSON.parse(fs.readFileSync(this._pInfoDirectoryFilePath))
                    )
                );
            } catch (e) {
                this.Logger.error('Error parsing config file. Inner exception is: ' + e);
                process.exit(1);
            }
            // User manager
            this._userManager = new Raa1UserManager(
                this._conf.CollaborativeListening.UserDBFile
            );
            // Feeds
            this._publicFeed = new Raa1PublicFeed(
                this._conf.CollaborativeListening.FeedDBFile
            );
            this._personalFeed = new Raa1PersonalFeed(
                this._conf.CollaborativeListening.FeedDBFile
            );

            // We also use some utility funtions of LineupManager but we do not init it.
            this._lineupFileNamePrefix = 'raa1';
            this._lineupManager = new LineupManager();

            this._startTimeCalculatorManager = new Raa1StartTimeCalculatorManager(
                this._conf.Adhan
            );

            this._objectBuilder = new ObjectBuilder({
                Box: LiquidsoapBox,
                Program: LiquidsoapProgram,
                Media: LiquidsoapMedia,
            });

            this._publicFeed.init();
            this._personalFeed.init();
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
        this.PublicFeed.shutdown();
        this.PersonalFeed.shutdown();

        process.exit();
    }

    registerAPI() {
        let self = this;
        this._webApp.use(bodyParser.json());

        this._webApp.post('/registerDevice/:deviceType/', (req, res) => {
            let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            let user = new User(req.body, req.params.deviceType, ip);
            self.UserManager.registerUser(user);
            // Regenerate users personal feed
            self.PersonalFeed.generatePersonalFeed(user);
            res.send('Success');
        });

        this._webApp.get('/publicFeed', async (req, res) => {
            try {
                let feed = this.PublicFeed.renderFeed();
                res.send(feed);
            } catch (error) {
                AppContext.getInstance.Logger.error(error.stack);
            }
        });

        this._webApp.get('/personalFeed/:userId', async (req, res) => {
            try {
                let userId = req.params['userId'];
                let feed = self.PersonalFeed.renderFeed(userId);
                res.send(feed);

                // Every time user fetches personal feed, we update user's last
                // seen active timestamp. This will help us expire stale users from our
                // db
                self.UserManager.reportUserActive(userId);
            } catch (error) {
                AppContext.getInstance().Logger.error(error.stack);
            }
        });

        this._webApp.get('/programInfoDirectory', (req, res) => {
            res.send(this._pInfoDirectoryString);
        });

        this._webApp.get('/linkgenerator/:medium', (req, res) => {
            let medium = req.params['medium'];
            let urlEncoded = req.query['src'];
            let reqUrl = Buffer.from(urlEncoded, 'base64').toString('ascii');

            if (reqUrl) {
                let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                let userAgent = req.headers['user-agent'];

                // Report to GA server
                let gaParams = {
                    v: '1',
                    tid: 'UA-103579661-1',
                    cid: '555',
                    t: 'event',
                    ea: 'play',
                };
                gaParams.el = reqUrl;
                gaParams.uip = ip;
                gaParams.ua = userAgent;
                gaParams.ec = medium;
                gaParams.ca = medium;
                gaParams.cn = medium;
                gaParams.cm = medium;

                let requestOptions = {
                    url: 'https://www.google-analytics.com/collect',
                    method: 'POST',
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                    form: gaParams,
                };

                request.post(requestOptions, function(error, response, body) {
                    if (error) {
                        self.logger.error('Error while sending GA request: ' + error);
                    }
                });

                return res.redirect(reqUrl);
            }

            return res.status(400).send('The querystring is missing or not valid');
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
        this._webApp.listen(this._conf.PublicAPIPort, () => {
            AppContext.getInstance().Logger.info(
                'Raa API started on port ' + this._conf.PublicAPIPort
            );
        });
    }

    get PublicFeed() {
        return this._publicFeed;
    }

    get PersonalFeed() {
        return this._personalFeed;
    }

    get UserManager() {
        return this._userManager;
    }

    get LineupManager() {
        return this._lineupManager;
    }

    get StartTimeCalculatorManager() {
        return this._startTimeCalculatorManager;
    }

    get LineupFileNamePrefix() {
        return this._lineupFileNamePrefix;
    }
}

/* === Entry Point === */
program.version('1.0.0').parse(process.argv);

if (program.args.length < 1) {
    console.log(
        'Usage: [NODE_ENV=production] node raa1-api.js {config-file}' +
            '{program-info-directory-file}'
    );
    process.exit(1);
}

new Raa1API(program).init();
