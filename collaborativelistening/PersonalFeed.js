const AppContext = require('../AppContext');
const DateUtils = require('../DateUtils');

const F = require('./Feed');
const Feed = F.Feed;
const FeedWatcher = F.FeedWatcher;
const FeedEntry = F.FeedEntry;

const U = require('../collaborativelistening/UserManager');
const User = U.User;

const moment = require('moment-timezone');
const fs = require('fs');

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
            'Program TEXT, UserId TEXT, ReleaseTimestamp REAL,' +
            'ExpirationTimestamp REAL,' +
            ' FOREIGN KEY(UserId) REFERENCES USER(Id), UNIQUE(Id))'
        );
        this._db.runSync('CREATE INDEX IF NOT EXISTS personalfeedentry_id_idx ON ' +
            'PersonalFeedEntry(Id)');

        if (this._historyProdiver) {
            this._historyProdiver._db.runSync(
                'CREATE TABLE IF NOT EXISTS PERSONALFEEDENTRY ' +
                '(Id TEXT PRIMARY_KEY, ' +
                'Program TEXT, UserId TEXT, ReleaseTimestamp REAL,' +
                'ExpirationTimestamp REAL,' +
                ' FOREIGN KEY(UserId) REFERENCES USER(Id), UNIQUE(Id))'
            );
        }

        this._type = PersonalFeedEntry;
        this._tableName = 'PersonalFeedEntry';

        this._currentPersonalProgramsJournal = [];
    }

    registerProgram(program, targetDate) {
        let self = this;

        let users = this.entryListAll(User, null);
        for (let user of users) {
            self.registerProgramForUser(program, targetDate, user);
        }

        // Save program info for later user registerations
        this.addProgramToJournal(program, targetDate);
    }

    registerProgramForUser(program, targetDate, user) {
        let feedEntry = new PersonalFeedEntry();

        feedEntry.UserId = user.Id;

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
        }

        if (releaseMoment) {
            feedEntry.ReleaseTimestamp = DateUtils.getEpochSeconds(releaseMoment);
        } else {
            feedEntry.ReleaseTimestamp = DateUtils.getEpochSeconds(
                program.Metadata.StartTime
            );
        }

        feedEntry.ExpirationTimestamp = DateUtils.getEpochSeconds(
            moment
            .unix(feedEntry.ReleaseTimestamp)
            .add(program.Metadata.Duration, 'seconds')
        );
        feedEntry.Program = program;

        // If the feed is already expired, why publish?
        // This case might happen when we are replanning
        // dates from the past.
        if (feedEntry.ExpirationTimestamp < moment().unix()) {
            return;
        }

        if (AppContext.getInstance('LineupGenerator').GeneratorOptions.TestMode) {
            AppContext.getInstance().Logger.debug(
                'Register program to personal feed with entry: ' +
                JSON.stringify(feedEntry, null, 2)
            );
        } else {
            // Remove old entry (if any)
            this.unpersist(feedEntry);
            this.persist(feedEntry);
        }
    }

    addProgramToJournal(program) {
        this._shouldPersistJournal = true;
        this._currentPersonalProgramsJournal.push(program);
    }

    getJournalFilePath(targetDate) {
        return AppContext.getInstance().CWD +
            `/run/cl-workspace/personal-programs-journal-${targetDate}.json`;
    }

    commitJournal(targetDate) {
        if (!AppContext.getInstance('LineupGenerator').GeneratorOptions.TestMode) {
            // Write the current journal (if any) to disk
            if (this._shouldPersistJournal) {
                fs.writeFileSync(this.getJournalFilePath(targetDate),
                    JSON.stringify(this._currentPersonalProgramsJournal, null, 2));
            }
        } else {
            AppContext.getInstance().Logger.info(
                `Personal feed journal for ${targetDate} is: ` +
                `${JSON.stringify(this._currentPersonalProgramsJournal, null, 2)}`);
        }
        // Empty journal, another for another date to come
        this._currentPersonalProgramsJournal = [];
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
            let journalFilePath = this.getJournalFilePath(dateString);
            if (fs.existsSync(journalFilePath)) {
                let currentPersonalProgramsJournal =
                    JSON.parse(fs.readFileSync(journalFilePath, 'utf-8'));

                for (let program of currentPersonalProgramsJournal) {
                    this.registerProgramForUser(program, dateString, user);
                }
            }
        }
    }

    deregisterUserPersonalFeedEntries(user) {
        return this.unpersistByQuery(this._type, {
            statement: 'UserId = ?',
            values: user.id,
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
}

module.exports = {
    PersonalFeed: PersonalFeed,
    PersonalFeedWatcher: PersonalFeedWatcher,
    PersonalFeedEntry: PersonalFeedEntry,
};
