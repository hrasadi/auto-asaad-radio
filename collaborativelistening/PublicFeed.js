const AppContext = require('../AppContext');
const DateUtils = require('../DateUtils');

const F = require('./Feed');
const Feed = F.Feed;
const FeedWatcher = F.FeedWatcher;
const FeedEntry = F.FeedEntry;

const moment = require('moment');

class PublicFeed extends Feed {
    constructor(dbFileName, historyDbFileName) {
        super(dbFileName, historyDbFileName);
    }

    async init() {
        await this.init1();

        // TODO:
        // CREATE INDEX publicfeedentry_id_idx ON publicfeedentry(id);
        await this._db.runAsync(
            'CREATE TABLE IF NOT EXISTS PUBLICFEEDENTRY ' +
                '(Id TEXT PRIMARY_KEY, ' +
                'Program TEXT, Upvotes INTEGER, ReleaseTimestamp REAL,' +
                'ExpirationTimestamp REAL, UNIQUE(Id))'
        );
        await this._db.runAsync(
            'CREATE TABLE IF NOT EXISTS UPVOTES ' +
                '(UserId TEXT, ' +
                'ProgramId TEXT, Timestamp REAL, ' +
                'PRIMARY KEY(UserId, ProgramId), ' +
                'FOREIGN KEY(UserId) REFERENCES USER(Id), ' +
                'UNIQUE(UserId), UNIQUE(ProgramId))'
        );

        if (this._historyProdiver) {
            await this._historyProdiver._db.runAsync(
                'CREATE TABLE IF NOT EXISTS PUBLICFEEDENTRY ' +
                    '(Id TEXT PRIMARY_KEY, ' +
                    'Program TEXT, Upvotes INTEGER, ReleaseTimestamp REAL,' +
                    'ExpirationTimestamp REAL, UNIQUE(Id))'
            );
            await this._historyProdiver._db.runAsync(
                'CREATE TABLE IF NOT EXISTS UPVOTES ' +
                    '(UserId TEXT ,' +
                    'ProgramId TEXT, Timestamp REAL,' +
                    'PRIMARY KEY(UserId, ProgramId), ' +
                    'FOREIGN KEY(UserId) REFERENCES USER(Id), ' +
                    'UNIQUE(UserId), UNIQUE(ProgramId))'
            );
        }

        this._type = PublicFeedEntry;
        this._tableName = 'PublicFeedEntry';
    }

    async registerProgram(program, releaseMoment) {
        let feedEntry = new PublicFeedEntry();
        if (releaseMoment) {
            feedEntry.ReleaseTimestamp = DateUtils.getEpochSeconds(releaseMoment);
        } else {
            feedEntry.ReleaseTimestamp = DateUtils.getEpochSeconds(
                program.Metadata.StartTime
            );
        }

        feedEntry.ExpirationTimestamp = DateUtils.getEpochSeconds(
            moment.unix(feedEntry.ReleaseTimestamp).add(
                program.Publishing.CollaborativeListeningProps.DefaultLife,
                'hours')
        );
        feedEntry.Program = program;
        feedEntry.Upvotes = 0;

        // If the feed is already expired, why publish?
        // This case might happen when we are replanning
        // dates from the past.
        if (feedEntry.ExpirationTimestamp < moment().unix()) {
            return;
        }

        // Delete any entries with same Id exists from before (old onces)
        // We will continue on complete callback from deregister (note async func)
        await this.deregisterFeedEntry(feedEntry);

        if (AppContext.getInstance('LineupGenerator').GeneratorOptions.TestMode) {
            AppContext.getInstance().Logger.debug(
                'Register program to public feed with entry: ' +
                    JSON.stringify(feedEntry, null, 2)
            );
        } else {
            await this.persist(feedEntry);
        }
    }

    upvoteProgram(programId, userId) {
        // TODO:
        AppContext.getInstance().Logger.debug(
            'Upvote program Id ' + programId + ' by user ' + userId
        );
    }

    renderFeed() {
        let now = DateUtils.getEpochSeconds(moment());
        return this.entryListAll(PublicFeedEntry, {
            statement: 'ReleaseTimestamp < ?', // skip programs planned for future
            values: now,
        });
    }

    getWatcher() {
        return new PublicFeedWatcher(this);
    }
}

class PublicFeedWatcher extends FeedWatcher {
    constructor(feed) {
        super(feed);
    }
}

class PublicFeedEntry extends FeedEntry {
    constructor() {
        super();
    }

    // Override parent (calculate id)
    get Program() {
        return this._program;
    }

    set Program(value) {
        if (value) {
            this._id = Buffer.from(value.CanonicalIdPath).toString('base64');
            this._program = JSON.stringify(value);
        }
    }

    get Upvotes() {
        return this._upvotes;
    }

    set Upvotes(value) {
        this._upvotes = value;
    }
}

module.exports = {
    PublicFeed: PublicFeed,
    PublicFeedWatcher: PublicFeedWatcher,
    PublicFeedEntry: PublicFeedEntry,
};
