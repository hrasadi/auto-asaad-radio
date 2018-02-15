const SerializableObject = require('../../entities/SerializableObject');

const fs = require('fs');

class PlaybackClipQueue extends SerializableObject {
    static buildQueue(queueFilePath) {
        if (fs.existsSync(queueFilePath)) {
            return new PlaybackClipQueue(
                JSON.parse(fs.readFileSync(queueFilePath), 'utf-8'),
                queueFilePath
            );
        }
        // return new queue
        return new PlaybackClipQueue(null, queueFilePath);
    }

    constructor(jsonOrOther, queueFilePath) {
        super(jsonOrOther);
        this._queueFilePath = queueFilePath;
    }

    size() {
        return this._queue.length;
    }

    enqueueClip(clip) {
        if (clip) {
            this.Queue.push(clip);
        }
    }

    deqeueClip() {
        if (this.Queue.length > 0) {
            return this.Queue.splice(0, 1);
        }
        return null;
    }

    peakClip() {
        if (this.Queue.length > 0) {
            return this.Queue[0];
        }
        return null;
    }

    persist() {
        fs.writeFileSync(this._queueFilePath, JSON.stringify(this));
    }

    get Queue() {
        this._queue = this.getOrElse(this._queue, []);
        return this._queue;
    }

    set Queue(value) {
        if (value) {
            this._queue = [];
            for (let clip of value) {
                this._queue.push(new PlaybackClip(clip));
            }
        }
    }
}

class PlaybackClip extends SerializableObject {
    constructor(jsonOrOther) {
        super(jsonOrOther);
    }

    get ClipAbsolutePath() {
        return this.getOrNull(this._clipAbsolutePath);
    }

    set ClipAbsolutePath(value) {
        this._clipAbsolutePath = value;
    }

    get MarksStartOfProgram() {
        return this.getOrNull(this._marksStartOfProgram);
    }

    set MarksStartOfProgram(value) {
        this._marksStartOfProgram = value;
    }
}

module.exports = {
    'PlaybackClipQueue': PlaybackClipQueue,
    'PlaybackClip': PlaybackClip,
};
