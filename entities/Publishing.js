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
        if (typeof value === 'boolean') {
            this._archive = value;
        } else {
            if (value && value.toLowerCase() === 'true') {
                this._archive = true;
            } else {
                this._archive = false;
            }
        }
    }

    get Podcast() {
        return this.getOrElse(this._podcast, false);
    }

    set Podcast(value) {
        if (typeof value === 'boolean') {
            this._podcast = value;
        } else {
            if (value && value.toLowerCase() === 'true') {
                this._podcast = true;
            } else {
                this._podcast = false;
            }
        }
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
        if (this.getOrNull(this._collaborativeListeningProps) != null) {
            // In cases other that lineup generation, we do not need the defaults to
            // be loaded, and we know that props exist. So just return
            return this._collaborativeListeningProps;
        } else {
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
