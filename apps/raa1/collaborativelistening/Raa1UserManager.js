const AppContext = require('../../../AppContext');

const U = require('../../../collaborativelistening/UserManager');
const UserManager = U.UserManager;
const User = U.User;
const DeviceTypeEnum = U.DeviceTypeEnum;

const apn = require('apn');

class Raa1UserManager extends UserManager {
    constructor(dbFileName, credentials) {
        super(dbFileName);
    }

    init(credentials) {
        this._credentials = credentials;

        this.initAPNS();
        this.initFCM();

        this.init1();
    }

    shutdown() {
        // Cool. Let's cleanup now
        this._apnProvider.shutdown();
        // Handle node-apn shutdown bug
        // https://github.com/node-apn/node-apn/issues/543
        this._apnProvider.client.endpointManager._endpoints.forEach((endpoint) =>
            endpoint.destroy()
        ); // will do
        this._firebase.app().delete();

        this.shutdown0();
    }

    initAPNS() {
        // Configure APN endpoint
        let apnProviderOptions = {
            token: {},
            production: true,
        };

        apnProviderOptions.token.key =
            AppContext.getInstance().CWD + '/' + this._credentials.APNS.key;
        apnProviderOptions.token.keyId = this._credentials.APNS.keyId;
        apnProviderOptions.token.teamId = this._credentials.APNS.teamId;

        this._apnProvider = new apn.Provider(apnProviderOptions);
    }

    initFCM() {
        this._firebase = require('firebase-admin');
        let serviceAccount = require(AppContext.getInstance().CWD +
            '/' +
            this._credentials.Firebase);

        this._firebase.initializeApp({
            credential: this._firebase.credential.cert(serviceAccount),
            databaseURL: 'https://raa-android.firebaseio.com',
        });
    }

    notifyUser(userId, alert, feedEntry, program, entryType) {
        let requiredNotificationPermission = RequiredNotificationPermission[entryType];
        // Notify iOS
        let iosUsers = this.entryListAll(User, {
            statement: 'Id = ? and DeviceType = ? and ' +
                requiredNotificationPermission +
                ' = 1' +
                ' and NotificationToken != ""',
            values: [userId, DeviceTypeEnum.iOS],
        });
        if (entryType === 'Personal') {
            iosUsers = iosUsers.filter((user) => {
                if (user.NotificationExcludedPersonalPrograms) {
                    let excluded = JSON.parse(user.NotificationExcludedPersonalPrograms);
                    if (excluded[program.ProgramId]) {
                        return false;
                    }
                }
                return true;
            });
        }
        if (iosUsers.length > 0) {
            this.notifyAPNS(
                iosUsers.map((user) => user.NotificationToken),
                alert,
                feedEntry.Id,
                entryType
            );
            AppContext.getInstance().Logger.debug(
                `Custom APNS notification sent to ${userId} with content ${alert}`
            );
        } else {
            AppContext.getInstance().Logger.debug(
                `User ${userId} settings didn't not allow to send` +
                `notification with content ${alert}.`
            );
        }

        // Notify FCM
        let fcmUsers = this.entryListAll(User, {
            statement: 'Id = ? and DeviceType = ? and ' +
                requiredNotificationPermission +
                ' = 1' +
                ' and NotificationToken != ""',
            values: [userId, DeviceTypeEnum.Android],
        });
        if (entryType === 'Personal') {
            fcmUsers = fcmUsers.filter((user) => {
                if (user.NotificationExcludedPersonalPrograms) {
                    let excluded = JSON.parse(user.NotificationExcludedPersonalPrograms);
                    if (excluded[program.ProgramId]) {
                        return false;
                    }
                }
                return true;
            });
        }
        if (fcmUsers.length > 0) {
            this.notifyFCM(
                fcmUsers.map((user) => user.NotificationToken),
                alert,
                feedEntry.Id,
                entryType
            );
            AppContext.getInstance().Logger.debug(
                `Custom FCM notification sent to ${userId} with content ${alert}`
            );
        } else {
            AppContext.getInstance().Logger.debug(
                `User ${userId} settings didn't not allow to send` +
                `notification with content ${alert}.`
            );
        }
    }

    notifyAllUsers(alert, feedEntry, program, entryType) {
        let requiredNotificationPermission = RequiredNotificationPermission[entryType];
        // Notify iOS
        let iosUsers = this.entryListAll(User, {
            statement: 'DeviceType = ? and ' +
                requiredNotificationPermission +
                ' = 1' +
                ' and NotificationToken != ""',
            values: DeviceTypeEnum.iOS,
        });
        // Make sure user does not exclude this program from notifications
        if (entryType == 'Public') {
            iosUsers = iosUsers.filter((user) => {
                if (user.NotificationExcludedPublicPrograms) {
                    let excluded = JSON.parse(user.NotificationExcludedPublicPrograms);
                    if (excluded[program.ProgramId]) {
                        return false;
                    }
                }
                return true;
            });
        }

        this.notifyAPNS(
            iosUsers.map((user) => user.NotificationToken),
            alert,
            (feedEntry != null) ? feedEntry.Id : null, // Live programs dont have entryId
            entryType
        );
        AppContext.getInstance().Logger.debug(
            `APNS notification with content ${alert}` +
            ` sent to ${iosUsers.length} user(s)`
        );

        // Notify FCM
        let fcmUsers = this.entryListAll(User, {
            statement: 'DeviceType = ? and ' +
                requiredNotificationPermission +
                ' = 1' +
                ' and NotificationToken != ""',
            values: DeviceTypeEnum.Android,
        });
        // Make sure user does not exclude this program from notifications
        if (entryType == 'Public') {
            fcmUsers = fcmUsers.filter((user) => {
                if (user.NotificationExcludedPublicPrograms) {
                    let excluded = JSON.parse(user.NotificationExcludedPublicPrograms);
                    if (excluded[program.ProgramId]) {
                        return false;
                    }
                }
                return true;
            });
        }

        this.notifyFCM(
            fcmUsers.map((user) => user.NotificationToken),
            alert,
            (feedEntry != null) ? feedEntry.Id : null, // Live programs dont have entryId
            entryType
        );
        AppContext.getInstance().Logger.debug(
            `FCM notification with content ${alert}` +
            ` sent to ${fcmUsers.length} user(s)`
        );
    }

    notifyAPNS(recipientIds, alert, feedEntryId, entryType) {
        let notification = new apn.Notification({
            mutableContent: 1,
            expiry: Math.floor(Date.now() / 1000) + 3600,
            category: 'media.raa.' + entryType,
            topic: 'raa.raa-ios-player',
            contentAvailable: 1,
            payload: {
                sender: 'raa1',
            },
        });

        if (alert != null) {
            notification.alert = alert;
            notification.badge = 1;
            notification.payload['feedEntryId'] = feedEntryId;
            notification.sound = 'ProgramStart.caf';
        } else {
            // otherwise deliver empty alert which indicates
            // playback end and clears all previous alerts
            notification.badge = 0;
        }

        this._apnProvider.send(notification, recipientIds).then((response) => {
            if (response.failed && response.failed.length > 0) {
                AppContext.getInstance().Logger.info(
                    `Failed APNS messages: ${JSON.stringify(response.failed)}`
                );
                // Remove user if we have BadToken error (removed the app. etc.)
                for (let failure of response.failed) {
                    if (failure.status == '410') { // Bad device token
                        AppContext.getInstance().Logger.info(
                            `Device "${failure.device}" marked for deletion as ` +
                            `it seems not to be running RAA anymore.`
                        );
                        this.removeUserByNotificationToken(failure.device);
                    }
                }
            }
        });
    }

    notifyFCM(recipientIds, alert, feedEntryId, entryType) {
        let payload = {
            data: {
                sender: 'raa1',
            },
            notification: {
                icon: 'ic_raa_logo_round_24dp',
                sound: 'program_start',
            },
        };

        if (alert != null) {
            payload.notification.title = alert;
            payload.data.feedEntryId = feedEntryId;
        }

        // Save the recipientIds in the stack (FCM does not return them back to us)
        let self = this;
        ((rIds) => {
            self._firebase
                .messaging()
                .sendToDevice(rIds, payload)
                .then((response) => {
                    if (response.failureCount > 0) {
                        AppContext.getInstance().Logger.info(
                            `Failed FCM messages. Let's see if we have invalid token...`
                        );
                        // Remove user if token is not valid error (removed the app. etc.)
                        response.results.forEach((result, index) => {
                            if (result.error) {
                                if (result.error.code ===
                                    'messaging/invalid-registration-token' ||
                                    result.error.code ===
                                    'messaging/registration-token-not-registered') {
                                    AppContext.getInstance().Logger.info(
                                        `Device "${rIds[index]}" ` +
                                        `marked for deletion as ` +
                                        `it seems not to be running RAA anymore.`
                                    );
                                    this.removeUserByNotificationToken(rIds[index]);
                                }
                            }
                        });
                    }
                });
        })(recipientIds);
    }
}

const RequiredNotificationPermission = {
    Public: 'NotifyOnPublicProgram',
    Personal: 'NotifyOnPersonalProgram',
    Live: 'NotifyOnLiveProgram',
};

module.exports = {
    Raa1UserManager: Raa1UserManager,
    RequiredNotificationPermission: RequiredNotificationPermission,
};
