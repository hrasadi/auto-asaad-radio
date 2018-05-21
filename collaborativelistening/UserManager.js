const AppContext = require('../AppContext');
const DBProvider = require('./DBProvider');
const DBObject = require('./DBObject');

const moment = require('moment');
const request = require('sync-request');
const queryString = require('query-string');

const USER_INACTIVITY_SECONDS_BEFORE_EXPIRATION = 15 * 24 * 3600; // 15 days

class UserManager extends DBProvider {
    constructor(dbFileName) {
        super(dbFileName);
    }

    init() {
        this.init1();
    }

    init1() {
        this.init0();

        this._db.runSync(
            'CREATE TABLE IF NOT EXISTS "USER" (Id TEXT PRIMARY_KEY, ' +
                'DeviceType INTEGER, IP TEXT, TimeZone TEXT, Latitude REAL, ' +
                'Longitude REAL, Country TEXT, State TEXT, City TEXT, ' +
                'NotificationToken TEXT, NotifyOnPersonalProgram INTEGER, ' +
                'NotificationExcludedPersonalPrograms TEXT, ' +
                'NotifyOnPublicProgram INTEGER, ' +
                'NotificationExcludedPublicPrograms TEXT, ' +
                'NotifyOnLiveProgram INTEGER, LastActive REAL, UNIQUE(Id))'
        );
        this._db.runSync('CREATE INDEX IF NOT EXISTS user_notification_token_idx ' +
                                                    'ON User(NotificationToken)');
        this._db.runSync('CREATE INDEX IF NOT EXISTS user_id_idx ON User(Id)');

        this._type = User;
        this._tableName = 'User';
    }

    registerUser(user) {
        let currentUser = this.loadById(User, user.Id);
        if (currentUser) {
            // User exists, update
            this.update(user);
        } else {
            // This is a new user, if this user was registered before (with same token),
            // remove it first and reregister
            if (user.NotificationToken) {
                this.removeUserByNotificationToken(user.NotificationToken);
            }
            this.persist(user); // And save
        }

        // In case location data is not complete, try to fix it.
        this.fixMissingUserData(user);
    }

    reportUserActive(userId) {
        let user = this.getUser(userId);
        if (user) {
            // User exists, update the last active timestamp to now
            user.LastActive = moment().unix();
            this.update(user);
        }
    }

    fixMissingUserData(user) {
        if (!user.Latitude || !user.Longitude) {
            // Users's GPS was off. Just use the defaults, nothing to do here
            return;
        }
        if (!user.City) {
            // Try to find city name using lat/long (ask Google Geocoding)
            let city = null;
            city = this.getUserLocalityFromGoogle(user);

            if (city) {
                user.City = city;
            } else {
                // City name could not be found, use a default string (e.g. 'Your City')
                city = 'شهر شما';
            }

            this.updateUser(user);
        }
    }

    getUserActiveThreshold() {
        // now() - valid inactivity period
        return moment().unix() - USER_INACTIVITY_SECONDS_BEFORE_EXPIRATION;
    }

    updateUser(user) {
        this.update(new User(user));
    }

    getUser(userId) {
        return new User(this.loadById(User, userId));
    }

    removeUser(userId) {
        return this.unpersistById(User, userId);
    }

    removeUserByNotificationToken(notificationToken) {
        let query = DBObject.getDeletePreStatement(User, {
            statement: 'NotificationToken = ?',
            values: notificationToken,
        });
        return this._db.runSync(query.statement, query.values);
    }

    // implemented in subclasses
    notifyUser(userId, alert, program) {}
    notifyAllUsers(alert, feedEntry, program, entryType) {}

    getUserLocalityFromGoogle(user) {
        let qs = queryString.stringify({
            latlng: `${user.Latitude},${user.Longitude}`,
            key: `${AppContext.getInstance().Config.Credentials.GoogleGeocodingAPIKey}`,
        });

        let res = request(
            'GET',
            'https://maps.googleapis.com/' +
            '/maps/api/geocode/json?' +
            qs
        );

        if (res.statusCode > 400) {
            AppContext.getInstance().Logger.warn(
                `Error while querying google geocoding ${res.getBody()}`);
            return null;
        }

        let parsed = JSON.parse(res.getBody());
        for (let result of parsed.results) {
            for (let addressComponent of result.address_components) {
                if (addressComponent.types.includes('locality')) {
                    return addressComponent.long_name;
                }
            }
        }
        return null;
    }
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
        this._deviceType = value;
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

    get NotificationExcludedPersonalPrograms() {
        return this.getOrElse(this._notificationExcludedPersonalPrograms, null);
    }

    set NotificationExcludedPersonalPrograms(value) {
        this._notificationExcludedPersonalPrograms = value;
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

    get LastActive() {
        return this.getOrNull(this._lastActive);
    }

    set LastActive(value) {
        this._lastActive = value;
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
