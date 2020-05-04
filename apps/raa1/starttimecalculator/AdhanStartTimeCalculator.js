const StartTimeCalculator = require('../../../starttimecalculator/StartTimeCalculator');

const AppContext = require('../../../AppContext');
const DateUtils = require('../../../DateUtils');

const moment = require('moment');
const request = require('sync-request');
const queryString = require('query-string');

class AdhanStartTimeCalculator extends StartTimeCalculator {
    constructor(adhanConf) {
        super();

        this._adhanConf = adhanConf;
    }

    validate(scheduleObj) {
        if (!scheduleObj.Params.AdhanName) {
            throw Error(
                'Property "AdhanName" must be set with calulation method "Adhan".'
            );
        }
    }

    /**
     * Returns a moment with time in the user's local timezone
     * @param {String} targetDate target date in string format YYYY-MM-DD
     * @param {Schedule} scheduleObj schedule params
     * @param {User} user user object (or null for the radio live broadcast)
     * @return {moment} Loclaized start time moment
     */
    calculate(targetDate, scheduleObj, user) {
        this.validate(scheduleObj);

        if (!user || !user.Latitude || !user.Longitude) {
            user = this._adhanConf;
        }

        let timing = this.readAdhanTimings(targetDate, user);
        return timing[scheduleObj.Params.AdhanName];
    }

    readAdhanTimings(targetDate, user) {
        let targetDateInAPIFormat = moment(targetDate, 'DD-MM-YYYY');

        // There is a bug in aladhan API and that results in
        // errorneous city detection if there is space in city name
        // surround values in "" to workaround this.
        let qs = queryString.stringify({
            latitude: `${user.Latitude}`,
            longitude: `${user.Longitude}`,
            method: this._adhanConf.CalculationMethod,
        });

        let epochAndQueryString = DateUtils.getEpochSeconds(
            DateUtils.getDateStartMomentInUTC(targetDate)) + '?' + qs;
        let parsed = this.aladhanTimings(epochAndQueryString);

        if (!this.validateTimingsDate(parsed, targetDateInAPIFormat)) {
            // Explain the bug
            epochAndQueryString = DateUtils.getEpochSeconds(
                DateUtils.getDateStartMomentInUTC(targetDate).add(1, 'day')) + '?' + qs;
            parsed = this.aladhanTimings(epochAndQueryString);
            if (!this.validateTimingsDate(parsed, targetDateInAPIFormat)) {
                throw Error('Could not find a working combination for target date: '
                    + targetDate);
            }
        }

        let dateTimings = {};
        for (let adhanName in parsed.data.timings) {
            if (parsed.data.timings.hasOwnProperty(adhanName)) {
                let timingLocalMoment = moment.tz(
                    targetDate + ' ' + parsed.data.timings[adhanName],
                    'YYYY-MM-DD HH:mm',
                    parsed.data.meta.timezone
                );

                dateTimings[adhanName] = timingLocalMoment;
            }
        }

        return dateTimings;
    }

    aladhanTimings(qs) {
        let res = request(
            'GET',
            'http://api.aladhan.com' +
            '/timings/' +
            qs
        );

        if (res.statusCode > 400) {
            AppContext.getInstance().Logger.warn(
                'Adhan API request failed with error: ' +
                res.statusCode +
                ' ' +
                res.getBody()
            );
            return null;
        }

        if (res.statusCode > 300) {
            throw Error('Error while reading adhan times for given request: ' + qs);
        }
        return JSON.parse(res.getBody());
    }

    /**
     *
     * @param {object} parsedTimings JSON object containing the API call repose
     * @param {string} targetDate the target date in DD-MM-YYYY format
     * @return {boolean} true if the percieved date by API was equal to our
     * target date, otherwise false
     */
    validateTimingsDate(parsedTimings, targetDate) {
        if (parsedTimings.data.date.gregorian.date == targetDate) {
            return true;
        }
        return false;
    }
}

module.exports = AdhanStartTimeCalculator;
