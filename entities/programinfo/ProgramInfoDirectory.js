const ProgramInfo = require('./ProgramInfo');

const SerializableObject = require('../SerializableObject');

class ProgramInfoDirectory extends SerializableObject {
    constructor(jsonOrOther) {
        super(jsonOrOther);

        this.deflate();
    }

    deflate() {
        if (this.ProgramInfos) {
            for (let pname of Object.keys(this.ProgramInfos)) {
                this._programInfos[pname].deflateProgramInfo();
            }
        }
    }

    get ProgramInfos() {
        return this.getOrNull(this._programInfos);
    }

    set ProgramInfos(values) {
        if (values) {
            this._programInfos = {};
            for (let pname in values) {
                if (values.hasOwnProperty(pname)) {
                    this._programInfos[pname] = new ProgramInfo(values[pname]);
                }
            }
        }
    }
}

module.exports = ProgramInfoDirectory;
