const SerializableObject = require('./SerializableObject');

const Context = require('../Context');

const MediaDirectory = require('./media/MediaDirectory');

const B = require('./Box');
const BoxTemplate = B.BoxTemplate;
const Box = B.Box;

const moment = require('moment');

class LineupTemplate extends SerializableObject {
    constructor(jsonOrOther) {
        super(jsonOrOther);
    }

    plan(targetDate) {
        Context.Logger.info('Planning lineup for ' + targetDate);

        let lineupPlan = new LineupPlan();

        if (this.BoxTemplates) {
            lineupPlan.BoxPlans = [];
            for (let boxTemplate of this.BoxTemplates) {
                let boxPlan = boxTemplate.plan(targetDate, lineupPlan);
                if (boxPlan) {
                    lineupPlan.BoxPlans.push(boxPlan);
                }
            }
        }
        return lineupPlan;
    }

    get BoxTemplates() {
        return this.getOrNull(this._boxTemplates);
    }

    set BoxTemplates(values) {
        if (typeof values !== 'undefined' && values) {
            this._boxTemplates = [];
            for (let value of values) {
                let boxTemplate = new BoxTemplate(value, this);
                this._boxTemplates.push(boxTemplate);
            }
        }
    }

    get Version() {
        return this.getOrElse(this.value, Context.Defaults.Version);
    }

    set Version(value) {
        this._version = value;
    }

    get MediaDirectory() {
        return this.getOrNull(this._mediaDirectory);
    }

    set MediaDirectory(value) {
        if (value) {
            this._mediaDirectory = new MediaDirectory(value);
        }
    }
}

class LineupPlan extends SerializableObject {
    constructor(jsonOrOther) {
        super(jsonOrOther);
    }

    compile() {
        let lineup = new Lineup();

        let boxes = [];
        for (let boxPlan of this.BoxPlans) {
            let box = boxPlan.compile(lineup);
            if (box) {
                boxes.push(box);
            }
        }
        lineup.Boxes = boxes;

        // Sort, validate and merge floating boxes
        lineup.Boxes.sort((a, b) => {
            return moment(a.StartTime).isBefore(b.StartTime) ? -1 : 1;
        });

        // manually validate the compiled lineup
        lineup.validate();

        return lineup;
    }

    getBoxPlan(boxId) {
        if (!this.BoxPlans || this.BoxPlans.length == 0) {
            return null;
        }
        for (let boxPlan of this.BoxPlans) {
            if (boxPlan.BoxId == boxId) {
                return boxPlan;
            }
        }
        return null;
    }

    get BoxPlans() {
        return this.getOrNull(this._boxPlans);
    }

    set BoxPlans(values) {
        this._boxPlans = values;
    }

    get Version() {
        return this.getOrElse(this._version, Context.Defaults.Version);
    }

    set Version(value) {
        this._version = value;
    }
}

class Lineup extends SerializableObject {
    constructor(jsonOrOther) {
        super(jsonOrOther);
    }

    /**
     * asserts that the boxes are not overlapping in time.
     * Exception is floating boxes as they can interrupt other
     * boxes.
     */
    validate() {
        if (!this.Boxes || this.Boxes.length == 0) {
            return;
        }
        for (let i = 0; i < this.Boxes.length; i++) {
            this.Boxes[i].validate();
            // floating box is valid
            if (this.Boxes[i].IsFloating) {
                continue;
            }
            // Except for the first box
            if (i > 0) {
                if (moment(this.Boxes[i].StartTime)
                        .isBefore(moment(this.Boxes[i - 1].EndTime)) &&
                    !this.Boxes[i - 1].IsFloating) {
                        throw Error('Boxes are overlapping: Box: ' +
                                this.Boxes[i - 1].BoxId + ' ending at: ' +
                                moment(this.Boxes[i - 1].EndTime).toString() +
                                ', with Box: ' + this.Boxes[i].BoxId +
                                ' starting at: ' +
                                moment(this.Boxes[i].StartTime).toString());
                    }
            }
        }
    }

    // implemented in the subclass
    schedule() {
    }

    // shared scheduling logic
    schedule0() {
        this.fixFloatingBoxes();
        this.validate();
    }

    /**
     * The idea is that floating boxes can collide other boxes
     * and interrupt them. As the actual playback switch is managed
     * using liquidsoap prioritized queues, we also need to manage
     * our lineup so that the information shown to listeners are
     * accurate
     */
    fixFloatingBoxes() {
        for (let i = 0; i < this.Boxes.length; i++) {
            if (this.Boxes[i].IsFloating) {
                if (i < this.Boxes.length) {
                    // floating box collides with next box
                    if (moment(this.Boxes[i + 1].StartTime)
                            .isBefore(moment(this.Boxes[i].EndTime))) {
                            // pushes the next box down
                        if (moment(this.Boxes[i].StartTime)
                                .isSameOrBefore(
                                moment(this.Boxes[i + 1].StartTime))) {

                            let shiftAmount =
                                moment(this.Boxes[i + 1].StartTime)
                                .diff(moment(this.Boxes[i].EndTime), 'seconds');

                            this.shiftBoxDown(i + 1, shiftAmount);
                        } else {
                            // the floating box should be
                            // wrapped by the program box
                            this.wrapBox(i, i + 1);
                        }
                    }
                }
                if (i > 0) {
                    // floating box collides with previous box
                    if (moment(this.Boxes[i].StartTime)
                            .isBefore(moment(this.Boxes[i - 1].EndTime))) {
                        this.wrapBox(i, i - 1);
                    }
                }
            }
        }
    }

    shiftBoxDown(targetBox, shiftAmount) {
        if (targetBox) {
            targetBox.EndTime = moment(targetBox.EndTime)
                                    .add(shiftAmount, 'seconds');
            // shift all the programs down as well
            targetBox.shiftProgramsDown(0, shiftAmount);
        }
    }

    wrapBox(floatingBoxIdx, wrappingBoxIdx) {
        this.Boxes[wrappingBoxIdx].EndTime =
                        moment(this.Boxes[wrappingBoxIdx].EndTime)
                        .add(this.Boxes[floatingBoxIdx].Duration, 'seconds');

        // Now inject floating box to the wrapping box;
        this.Boxes[wrappingBoxIdx] =
            this.Boxes[wrappingBoxIdx].injectProgram(
                    this.Boxes[floatingBoxIdx].Programs[0]);
        // And remove the floating box from the lineup;
        this.Boxes.splice(floatingBoxIdx, 1);
    }

    get Boxes() {
        return this.getOrElse(this._boxes, []);
    }

    set Boxes(values) {
        if (values) {
            this._boxes = [];
            for (let value of values) {
                if (value.constructor.name === 'Box') {
                    this._boxes.push(value);
                } else {
                    this._boxes.push(new Box(value));
                }
            }
        }
    }

    get Version() {
        return this.getOrElse(this._version, Context.Defaults.Version);
    }

    set Version(value) {
        this._version = value;
    }
}

module.exports = {
    'LineupTemplate': LineupTemplate,
    'LineupPlan': LineupPlan,
    'Lineup': Lineup,
};
