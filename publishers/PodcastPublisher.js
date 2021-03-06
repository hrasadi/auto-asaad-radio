const Publisher = require('./Publisher');

class PodcastPubliser extends Publisher {
    publish(program, targetDate) {
        // publish
        this.doPublish(program, targetDate);
    }

    // Implemented in subclasses (apps)
    doPublish(program, targetDate) {
    }
}

module.exports = PodcastPubliser;
