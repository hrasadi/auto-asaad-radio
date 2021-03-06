const Entity = require('./Entity');

const AppContext = require('../AppContext');
const DateUtils = require('../DateUtils');

const I = require('./media/iterator/Iterator');
const Iterator = I.Iterator;

const Media = require('./media/Media');

const moment = require('moment');

class BaseClip extends Entity {
    constructor(jsonOrOther) {
        super(jsonOrOther);
    }

    get IsMainClip() {
        return this.getOrElse(this._isMainClip, false);
    }

    set IsMainClip(value) {
        if (typeof value === 'boolean') {
            this._isMainClip = value;
        } else {
            if (value && value.toLowerCase() === 'true') {
                this._isMainClip = true;
            } else {
                this._isMainClip = false;
            }
        }
    }
}

class ClipTemplate extends BaseClip {
    constructor(jsonOrOther, parent) {
        super(jsonOrOther);

        // REFERENCES
        this._parentShowTemplate = parent;
    }

    plan(targetDate, clipIndex) {
        let iteratorId = this._parentShowTemplate._parentProgramTemplate
                            ._parentBoxTemplate.BoxId + '-' +
                            this._parentShowTemplate
                            ._parentProgramTemplate.ProgramId + '-' +
                            this._parentShowTemplate.constructor.name + '-' +
                            clipIndex;

        // If the point is in future, the counter should be immutable
        // note that we might be replanning a date in the past
        // (so this value could become negative)
        let futureOffset =
            moment(targetDate).diff(moment(DateUtils.getTodayString()), 'days');

        if (!this.MediaGroup || !this.MediaGroup.Media) {
            AppContext.getInstance().Logger.error('MediaGroup ' +
                                    this.MediaGroupName + ' could not be found.');
        }
        // immutable if in future
        let counter = Iterator.createDateCounter(this.IteratorPolicy,
            iteratorId, this.MediaGroup.Media.length,
            (futureOffset > 0) ? true : false);

        // When planning future, an extra offset should be applied
        // However, since the counter already persisted next value
        // when plannning the current date, we should decrease one
        // from it
        let extraFutureOffset = (futureOffset > 0) ? futureOffset - 1 : 0;

        try {
            let mediaIdx = counter.next(targetDate,
                    this.Offset + extraFutureOffset);

            if (mediaIdx == null) {
                return null;
            }

            let clipPlan = new ClipPlan(this);

            if (!this.MediaGroup.Media[mediaIdx]) {
                throw Error(`Media cannot be found for group ` +
                            `${this.MediaGroup.Name} and index ${mediaIdx}`);
            }
            clipPlan.Media = this.MediaGroup.Media[mediaIdx].plan();

            return clipPlan;
        } catch (e) {
            let wrappedError =
                    Error(`Error while planning clip if media group: ` +
                            `${this.MediaGroup.Name}.` +
                            ` Inner exception is: \n ${e}`);
            throw wrappedError;
        }
    }

    get MediaGroupName() {
        return this.getOrNull(this._mediaGroupName);
    }

    set MediaGroupName(value) {
        this._mediaGroupName = value;
    }

    get MediaGroup() {
        return this._parentShowTemplate
            ._parentProgramTemplate._parentBoxTemplate
            ._parentLineupTemplate.MediaDirectory
            .getMediaGroup(this.MediaGroupName);
    }

    get IteratorPolicy() {
        return this.getOrNull(this._iteratorPolicy);
    }

    set IteratorPolicy(value) {
        this._iteratorPolicy = value;
    }

    get Offset() {
        return this.getOrElse(this._offset, 0);
    }

    set Offset(value) {
        if (value) {
            this._offset = parseInt(value);
        }
    }
}

class ClipPlan extends BaseClip {
    constructor(jsonOrOther) {
        super(jsonOrOther);
    }

    compile(parent) {
        let compiledClip = new Clip(this);

        if (this.Media) {
            compiledClip.Media = this.Media.compile();
        }
        return compiledClip;
    }

    get Media() {
        return this.getOrNull(this._media);
    }

    /**
     * @param {Media} value Clip's media
     */
    set Media(value) {
        if (value) {
            this._media = AppContext.getInstance().ObjectBuilder
                                                    .buildOfType(Media, value);
        }
    }
}

class Clip extends BaseClip {
    constructor(jsonOrOther) {
        super(jsonOrOther);
    }

    get Media() {
        return this.getOrNull(this._media);
    }

    set Media(value) {
        if (value) {
            this._media = AppContext.getInstance().ObjectBuilder
                                                    .buildOfType(Media, value);
        }
    }

    getDuration() {
        if (this.Media) {
            return this.Media.Duration;
        }
        return 0;
    }
}

module.exports = {
    'ClipTemplate': ClipTemplate,
    'ClipPlan': ClipPlan,
    'Clip': Clip,
};
