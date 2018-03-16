const moment = require('moment-timezone');

class DateUtils {
    /**
     * Reads date string from moment (in UTC + 14 timezone)
     * @param {moment} m Moment object to get date from
     * @return {String} Date string
     */
    static getDateString(m) {
        return m.tz('Pacific/Kiritimati').format('YYYY-MM-DD');
    }

    static getTodayString() {
        return DateUtils.getDateString(moment());
    }

    static getNowInTimeZone() {
        return moment.tz('Pacific/Kiritimati');
    }

    static getEpochSeconds(m) {
        // .unix() returns timestamp is Epoch seconds
        return moment(m).seconds(0).unix();
    }

    static getDateStartMomentInTimeZone(m) {
        return moment(m).tz('Pacific/Kiritimati').hours(0).minutes(0).seconds(0);
    }

    static getDateStartMomentInUTC(m) {
        return moment(m).tz('UTC').hours(0).minutes(0).seconds(0);
    }
}

module.exports = DateUtils;
