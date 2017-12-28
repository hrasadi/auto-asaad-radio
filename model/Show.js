const SerializableObject = require('./SerializableObject');

const Clip = require('./Clip');

class BaseShow extends SerializableObject {
    constructor(jsonOrOther) {
        super(jsonOrOther);
    }

    get Clips() {
        return this.getOrNull(this._clips);
    }

    set Clips(values) {
        if (typeof values !== 'undefined' && values) {
            this._clips = [];
            for (let value of values) {
                let clip = Clip.create(value);
                this._clips.push(clip);
            }
        }
    }
}

class Show extends BaseShow {
    constructor(jsonOrOther) {
        super(jsonOrOther);
    }
}

class PreShow extends BaseShow {
    constructor(jsonOrOther) {
        super(jsonOrOther);
    }

    get FillerClip() {
        return this.getOrNull(this._fillerClip);
    }

    set FillerClip(value) {
        this._fillerClip = value;
    }
}

module.exports = {
    'Show': Show,
    'PreShow': PreShow,
};