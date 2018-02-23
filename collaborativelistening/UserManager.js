const DBProvider = require('./DBProvider');
const DBObject = require('./DBObject');

class UserManager extends DBProvider {
    constructor(dbFileName) {
        super(dbFileName);
    }

    init() {
        this.init1();
    }

    async init1() {
        await this.init0();

        // CREATE INDEX user_notification_token_idx ON user(notificationtoken);
        // CREATE INDEX user_id_idx ON user(id);
        this._db.runAsync(
            'CREATE TABLE IF NOT EXISTS "USER" (Id TEXT PRIMARY_KEY, ' +
                'DeviceType INTEGER, IP TEXT, TimeZone TEXT, Latitude REAL, ' +
                'Longitude REAL, Country TEXT, State TEXT, City TEXT, ' +
                'NotificationToken TEXT, NotifyOnPersonalProgram INTEGER, ' +
                'NotifyOnPublicProgram TEXT, NotificationExcludedPublicPrograms TEXT, ' +
                'NotifyOnLiveProgram INTEGER, UNIQUE(Id))'
        );

        this._type = User;
        this._tableName = 'User';
    }

    async registerUser(user) {
        let currentUser = await this.loadById(User, user.Id);
        if (currentUser) {
            // User exists, update
            this.update(user);
        } else {
            // This is a new user, if this user was registered before (with same token),
            // remove it first and reregister
            if (user.NotificationToken) {
                await this.removeUserByNotificationToken(user.NotificationToken);
            }
            this.persist(user); // And save
        }
    }

    updateUser(user) {
        this.update(user);
    }

    getUser(userId) {
        return this.loadById(User, userId);
    }

    removeUser(userId) {
        return this.unpersistById(User, userId);
    }

    removeUserByNotificationToken(notificationToken) {
        let query = DBObject.getDeletePreStatement(User, {
            statement: 'NotificationToken = ?',
            values: notificationToken,
        });
        return this._db.runAsync(query.statement, query.values);
    }

    // implemented in subclasses
    notifyUser(userId, alert, program) {}
    notifyAllUsers(alert, feedEntry, program, entryType) {}
}

class User extends DBObject {
    constructor(jsonOrOther, deviceType, ip) {
        super(jsonOrOther);

        if (deviceType) {
            this._deviceType = DeviceTypeEnum.fromString(deviceType);
        }

        if (ip) {
            this._ip = ip;
        }
    }

    get DeviceType() {
        return this.getOrNull(this._deviceType);
    }

    set DeviceType(value) {
        this._deviceType = DeviceTypeEnum[value];
    }

    get IP() {
        return this.getOrNull(this._ip);
    }

    set IP(value) {
        this._ip = value;
    }

    get TimeZone() {
        return this.getOrNull(this._timeZone);
    }

    set TimeZone(value) {
        this._timeZone = value;
    }

    get Latitude() {
        return this.getOrNull(this._latitude);
    }

    set Latitude(value) {
        this._latitude = value;
    }
    get Longitude() {
        return this.getOrNull(this._longitude);
    }

    set Longitude(value) {
        this._longitude = value;
    }

    get Country() {
        return this.getOrNull(this._country);
    }

    set Country(value) {
        this._country = value;
    }

    get State() {
        return this.getOrNull(this._state);
    }

    set State(value) {
        this._state = value;
    }

    get City() {
        return this.getOrNull(this._city);
    }

    set City(value) {
        this._city = value;
    }

    get NotificationToken() {
        return this.getOrNull(this._notificationToken);
    }

    set NotificationToken(value) {
        this._notificationToken = value;
    }

    get NotifyOnPersonalProgram() {
        return this.getOrElse(this._notifyOnPersonalProgram, 1);
    }

    set NotifyOnPersonalProgram(value) {
        this._notifyOnPersonalProgram = value;
    }

    get NotifyOnPublicProgram() {
        return this.getOrElse(this._notifyOnPublicProgram, 1);
    }

    set NotifyOnPublicProgram(value) {
        this._notifyOnPublicProgram = value;
    }

    get NotificationExcludedPublicPrograms() {
        return this.getOrElse(this._notificationExcludedPublicPrograms, null);
    }

    set NotificationExcludedPublicPrograms(value) {
        this._notificationExcludedPublicPrograms = value;
    }

    get NotifyOnLiveProgram() {
        return this.getOrElse(this._notifyOnLiveProgram, 0);
    }

    set NotifyOnLiveProgram(value) {
        this._notifyOnLiveProgram = value;
    }
}

const DeviceTypeEnum = Object.freeze({
    Web: 0,
    iOS: 1,
    Android: 2,

    fromString(string) {
        for (let key of Object.keys(this)) {
            if (key.toLowerCase() === string.toLowerCase()) {
                return this[key];
            }
        }
    },
});

module.exports = {
    UserManager: UserManager,
    User: User,
    DeviceTypeEnum: DeviceTypeEnum,
};
