const AppContext = require('../../../AppContext');

const P = require('../../../collaborativelistening/PersonalFeed');
const PersonalFeed = P.PersonalFeed;
const PersonalFeedWatcher = P.PersonalFeedWatcher;

class Raa1PersonalFeed extends PersonalFeed {
    getWatcher() {
        return new Raa1PersonalFeedWatcher(this);
    }

    notifyProgramStart(feedEntry) {
        let program = JSON.parse(feedEntry.Program);
        let message = 'برنامه‌ی مخصوص شما: ' + program.Title;
        AppContext.getInstance('Raa1CLWatcher').UserManager.notifyUser(
            feedEntry.UserId,
            message,
            feedEntry,
            program,
            'Personal'
        );
    }
}

class Raa1PersonalFeedWatcher extends PersonalFeedWatcher {
    constructor(feed) {
        super(feed);
    }
}

module.exports = {
    Raa1PersonalFeed: Raa1PersonalFeed,
    Raa1PersonalFeedWatcher: Raa1PersonalFeedWatcher,
};
