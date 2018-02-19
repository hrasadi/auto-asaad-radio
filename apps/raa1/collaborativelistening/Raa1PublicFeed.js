const AppContext = require('../../../AppContext');

const P = require('../../../collaborativelistening/PublicFeed');
const PublicFeed = P.PublicFeed;
const PublicFeedWatcher = P.PublicFeedWatcher;

class Raa1PublicFeed extends PublicFeed {
    getWatcher() {
        return new Raa1PublicFeedWatcher(this);
    }

    notifyProgramStart(feedEntry) {
        let program = JSON.parse(feedEntry.Program);
        let message = 'برنامه‌‌ای جدید منتشر شده: ' + program.Title;
        AppContext.getInstance('Raa1CLWatcher').UserManager.notifyAllUsers(
            message,
            program,
            'Public'
        );
    }
}

class Raa1PublicFeedWatcher extends PublicFeedWatcher {
    constructor(feed) {
        super(feed);
    }
}

module.exports = {
    Raa1PublicFeed: Raa1PublicFeed,
    Raa1PublicFeedWatcher: Raa1PublicFeedWatcher,
};
