const SerializableObject = require('./SerializableObject');

const CustomAction = require('./CustomAction');

const AppContext = require('../AppContext');

class Entity extends SerializableObject {
    constructor(jsonOrOther) {
        super(jsonOrOther);
    }

    // Implemented in subclasses
    onEvent() {
    }

    onEvent0(eventName) {
        let customActions = this.findCustomAction(eventName);
        if (customActions) {
            for (let customAction of customActions) {
                let action = AppContext.getInstance('LineupGenerator').ActionManager
                                        .getAction(customAction.Action);
                if (action) {
                    action(this, customAction.Params);
                }
            }
        }
    }

    findCustomAction(eventName) {
        let result = [];
        if (this.CustomActions) {
            for (let customAction of this.CustomActions) {
                if (customAction.On === eventName) {
                    result.push(customAction);
                }
            }
            return result;
        }
        return null;
    }

    /**
     * Called during plan phase
     */
    evaluateCustomActionParams() {
        if (this.CustomActions) {
            for (let caction of this.CustomActions) {
                if (caction.Params) {
                    for (let param in caction.Params) {
                        if (caction.Params.hasOwnProperty(param)) {
                            caction.Params[param] =
                                this.evaluateCustomActionParam(caction.Params[param]);
                        }
                    }
                }
            }
        }
    }

    // Implemented in subclass
    evaluateCustomActionParam(param) {
    }

    get CustomActions() {
        return this.getOrNull(this._customActions);
    }

    set CustomActions(values) {
        if (values) {
            this._customActions = [];
            for (let value of values) {
                this._customActions.push(new CustomAction(value));
            }
        } else {
            this._customActions = null;
        }
    }
}

module.exports = Entity;
