const AppContext = require('../AppContext');
const DateUtils = require('../DateUtils');

const F = require('./Feed');
const Feed = F.Feed;
const FeedWatcher = F.FeedWatcher;
const FeedEntry = F.FeedEntry;

const U = require('../collaborativelistening/UserManager');
const User = U.User;

const P = require('../entities/Program');
const Program = P.Program;

const moment = require('moment-timezone');

class PersonalFeed extends Feed {
    constructor(dbFileName, historyDbFileName) {
        super(dbFileName, historyDbFileName);
    }

    init() {
        // Wait until the all promises are resolved
        this.init1();

        this._db.runSync(
            'CREATE TABLE IF NOT EXISTS PERSONALFEEDENTRY ' +
            '(Id TEXT PRIMARY_KEY, ' +
            'Program TEXT, UserId TEXT, ReleaseTimestamp REAL, ' +
            'ShowStartOffset REAL, ExpirationTimestamp REAL, UNIQUE(Id))'
        );
        this._db.runSync('CREATE INDEX IF NOT EXISTS personalfeedentry_id_idx ON ' +
            'PersonalFeedEntry(Id)');

        if (this._historyProdiver) {
            this._historyProdiver._db.runSync(
                'CREATE TABLE IF NOT EXISTS PERSONALFEEDENTRY ' +
                '(Id TEXT PRIMARY_KEY, ' +
                'Program TEXT, UserId TEXT, ReleaseTimestamp REAL, ' +
                'ShowStartOffset REAL, ExpirationTimestamp REAL, UNIQUE(Id))'
            );
        }

        this._type = PersonalFeedEntry;
        this._tableName = 'PersonalFeedEntry';
    }

    /** This function only registers program for users who are active (used app recently)
     * @param {Program} program The program to register in personal feed
     * @param {String} targetDate The target date
     * */
    registerProgram(program, targetDate) {
        let self = this;

        let users = AppContext.getInstance().UserManager.entryListAll(User, {
            statement: 'LastActive > ?',
            values: [AppContext.getInstance().UserManager.getUserActiveThreshold()],
        });
        for (let user of users) {
            self.registerProgramForUser(program, targetDate, user);
        }
    }

    registerProgramForUser(unpersonalizedProgram, targetDate, user) {
        let program = new Program(
            unpersonalizedProgram,
            unpersonalizedProgram._parentBox
        );
        let feedEntry = new PersonalFeedEntry();

        feedEntry.UserId = user.Id;

        // If users city is undetermied, try to find it out
        AppContext.getInstance().UserManager.fixMissingUserData(user);

        // Override program name if configured so
        let programTitle = program.Title;
        if (program.Publishing.CollaborativeListeningProps.OverrideProgramName) {
            if (user.City) {
                programTitle =
                    program.Publishing.CollaborativeListeningProps.OverrideProgramName;
                programTitle = programTitle.replace(/__user_city__/gi, user.City);
            }
        }

        program.Title = programTitle;

        let releaseMoment = program._parentBox.Schedule.calculateStartTime(
            targetDate,
            user
        );
        // Take into effect the preshow and pull release time back by it's length
        if (program.PreShow) {
            let offset = moment(program.Metadata.ShowStartTime).diff(
                program.Metadata.PreShowStartTime,
                'seconds'
            );
            releaseMoment = moment(releaseMoment).subtract(offset, 'seconds');
            // If there is a PreShow, also store the offset which will be used in the apps
            // to rebuild the ShowStartTime for the customer.
            feedEntry.ShowStartOffset = offset;
        }
        feedEntry.ReleaseTimestamp = DateUtils.getEpochSeconds(releaseMoment);

        feedEntry.ExpirationTimestamp = DateUtils.getEpochSeconds(
            moment
                .unix(feedEntry.ReleaseTimestamp)
                .add(program.Metadata.Duration, 'seconds')
        );
        // If the feed is already expired, why publish?
        // This case might happen when we are replanning
        // dates from the past.
        if (feedEntry.ExpirationTimestamp < moment().unix()) {
            return;
        }

        feedEntry.Program = program;

        try {
            if (AppContext.getInstance('LineupGenerator').GeneratorOptions.TestMode) {
                AppContext.getInstance().Logger.debug(
                    'Register program to personal feed with entry: ' +
                    JSON.stringify(feedEntry, null, 2)
                );
                return;
            }
        } catch (e) {
            AppContext.getInstance()
                .Logger.info('Not a lineup generator context. Persist entry ...');
        }
        // Remove old entry (if any)
        this.unpersist(feedEntry);
        this.persist(feedEntry);
    }

    // This will regenerate all personal programs of a specific user every time user
    // re-registers with server
    generatePersonalFeed(user) {
        // Remove all previous personal feed entries
        this.deregisterUserPersonalFeedEntries(user);

        // Re-generate items from yesterday onwards (to cover timezone difference)
        let yesterday = DateUtils.getDateString(
            DateUtils.getNowInTimeZone().subtract(1, 'days'));
        let today = DateUtils.getDateString(DateUtils.getNowInTimeZone());

        for (let dateString of [yesterday, today]) {
            let lineup = AppContext.getInstance()
                .LineupManager.getPublishedLineup(dateString);

            if (lineup != null) {
                for (let box of lineup.Boxes) {
                    for (let program of box.Programs) {
                        if (program.Publishing.CollaborativeListeningFeed === 'Personal') {
                            this.registerProgramForUser(program, dateString, user);
                        }
                    }
                }
            }
        }
    }

    deregisterUserPersonalFeedEntries(user) {
        return this.unpersistByQuery(this._type, {
            statement: 'UserId = ?',
            values: user.Id,
        });
    }

    /*
        The conditional for this query used to be:
        'ReleaseTimestamp < ? and UserId = ?'
        We pushed the filtering responsibility to client app (for flexibility)
        and render the whole feed
     */
    renderFeed(userId) {
        // skip programs planned for future
        return this.entryListAll(PersonalFeedEntry, {
            statement: 'UserId = ?',
            values: userId,
        });
    }

    getWatcher() {
        return new PersonalFeedWatcher(this);
    }
}

class PersonalFeedWatcher extends FeedWatcher {
    constructor(feed) {
        super(feed);
    }
}

class PersonalFeedEntry extends FeedEntry {
    constructor() {
        super();
    }

    refreshId() {
        if (this._programCanonicalId && this._userId) {
            this.Id = Buffer.from(this._programCanonicalId + '/' + this._userId).toString(
                'base64'
            );
        }
    }

    get Program() {
        return this._program;
    }

    set Program(value) {
        if (value) {
            this._programCanonicalId = value.CanonicalIdPath;
            this.refreshId();

            this._program = JSON.stringify(value);
        }
    }

    /**
     * Foreign key to the target user id
     */
    get UserId() {
        return this._userId;
    }

    set UserId(value) {
        this._userId = value;
        this.refreshId();
    }

    /**
     * The timestamp of the switching between pre-show and the show pieces of
     * the program in the personal feed.
     */
    get ShowStartOffset() {
        return this._showStartOffset;
    }

    set ShowStartOffset(value) {
        this._showStartOffset = value;
    }
}

module.exports = {
    PersonalFeed: PersonalFeed,
    PersonalFeedWatcher: PersonalFeedWatcher,
    PersonalFeedEntry: PersonalFeedEntry,
};
