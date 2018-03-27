const DBProvider = require('./DBProvider');
const DBObject = require('./DBObject');

const CACHE_FLUSHING_FREQUENCY = 10000; // 10 seconds

class PublicFeedListeningLogger extends DBProvider {
    constructor(dbFileName) {
        super(dbFileName);

        this._logEntryCache = [];
    }

    init() {
        this.init1();

        let self = this;
        setInterval(() => self.tick(self), CACHE_FLUSHING_FREQUENCY);
        // Start with a firing
        this.tick(self);
    }

    init1() {
        this.init0();

        this._db.runSync(
            'CREATE TABLE IF NOT EXISTS PublicFeedListeningLogEntry ' +
                '(ProgramId TEXT, ListenersCount INTEGER, UNIQUE(ProgramId))'
        );

        this._type = PublicFeedListeningLogEntry;
        this._tableName = 'PublicFeedListeningLogEntry';
    }

    tick(self) {
        self.flushDB();
    }

    /**
     * Currently there is only one event available: listening to an item
     * @param {String} publicFeedEntryId Entry Id
     */
    logListenerEvent(publicFeedEntryId) {
        if (!this._logEntryCache[publicFeedEntryId]) {
            this._logEntryCache[publicFeedEntryId] = 0;
        }

        this._logEntryCache[publicFeedEntryId] += 1;
    }

    flushDB() {
        for (let publicFeedEntryId of this._logEntryCache.keys) {
            let previousLogEntry = this.loadById(this._type, publicFeedEntryId);
            let feedLogEntry = null;
            if (!previousLogEntry) {
                feedLogEntry = new PublicFeedListeningLogEntry();
                feedLogEntry.PublicFeedEntryId = publicFeedEntryId;
                feedLogEntry.ListenersCount = this._logEntryCache[publicFeedEntryId];
            } else {
                feedLogEntry = previousLogEntry;
                feedLogEntry.ListenersCount += this._logEntryCache[publicFeedEntryId];
            }

            this.persistOrUpdate(feedLogEntry);
        }

        // Empty cache
        this._logEntryCache = [];
    }
}

class PublicFeedListeningLogEntry extends DBObject {
    constructor(jsonOrOther) {
        super(jsonOrOther);
    }

    get PublicFeedEntryId() {
        return this.getOrNull(this._publicFeedEntryId);
    }

    set PublicFeedEntryId(value) {
        this._publicFeedEntryId = value;
    }

    get ListenersCount() {
        return this.getOrNull(this._listenersCount);
    }

    set ListenersCount(value) {
        this._listenersCount = value;
    }
}

module.exports = {
    'PublicFeedListeningLogger': PublicFeedListeningLogger,
    'PublicFeedListeningLogEntry': PublicFeedListeningLogEntry,
};
