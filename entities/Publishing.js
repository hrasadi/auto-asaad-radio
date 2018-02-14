const Entity = require('./Entity');

const AppContext = require('../AppContext');

class Publishing extends Entity {
    constructor(jsonOrOther, parent) {
        super(jsonOrOther);

        this._parent = parent;
    }

    validate() {}

    get PublicClipNamingStrategy() {
        return this.getOrElse(this._publicClipNamingStrategy, 'MainClip');
    }

    set PublicClipNamingStrategy(value) {
        this._publicClipNamingStrategy = value;
    }

    get Archive() {
        return this.getOrElse(this._archive, false);
    }

    set Archive(value) {
        this._archive = value;
    }

    get Podcast() {
        return this.getOrElse(this._podcast, false);
    }

    set Podcast(value) {
        this._podcast = value;
    }

    get PodcastFeed() {
        let defaultFeed = this._podcast
            ? AppContext.getInstance('LineupGenerator').Defaults.Publishing.PodcastFeed
            : null;
        return this.getOrElse(this._podcastFeed, defaultFeed);
    }

    set PodcastFeed(value) {
        this._podcastFeed = value;
    }

    get CollaborativeListeningFeed() {
        return this.getOrElse(this._collaborativeListeningFeed, 'None');
    }

    set CollaborativeListeningFeed(value) {
        if (value && !['Public', 'Personal', 'None'].includes(value)) {
            throw Error(
                'Invalid CollaborativeListening feed.' +
                    'Acceptable values are "Public", "Personal" and "None"'
            );
        }
        this._collaborativeListeningFeed = value;
    }

    get CollaborativeListeningProps() {
        let defaultCLProps =
            this._collaborativeListeningFeed !== 'None'
                ? Object.assign(
                      {},
                      AppContext.getInstance('LineupGenerator').Defaults.Publishing
                          .ColloborativeListening
                  )
                : null;
        return this.getOrElse(this._collaborativeListeningProps, defaultCLProps);
    }

    set CollaborativeListeningProps(value) {
        if (value) {
            value.DefaultLife = value.DefaultLife
                ? value.DefaultLife
                : AppContext.getInstance('LineupGenerator').Defaults.Publishing
                      .ColloborativeListening.DefaultLife;

            value.MaxLife = value.MaxLife
                ? value.MaxLife
                : AppContext.getInstance('LineupGenerator').Defaults.Publishing
                      .ColloborativeListening.MaxLife;

            value.UpvoteBonus = value.UpvoteBonus
                ? value.UpvoteBonus
                : AppContext.getInstance('LineupGenerator').Defaults.Publishing
                      .ColloborativeListening.UpvoteBonus;
        }

        this._collaborativeListeningProps = value;
    }
}

module.exports = Publishing;
