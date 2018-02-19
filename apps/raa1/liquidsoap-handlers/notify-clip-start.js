const request = require('request-promise');
const queryString = require('query-string');

function perform(liveStatus) {
    let qs = {};
    qs.message = 'در حال پخش زنده: ' + liveStatus.StartedProgramTitle;

    // This is a fast call. It will return immediately
    request.post(
        'http://localhost:7801/notifyAllUsersWithMessage?' + queryString.stringify(qs)
    );
}

module.exports = perform;
