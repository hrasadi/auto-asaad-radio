class DBObject {
    constructor(other) {
        if (other) {
            Object.assign(this, JSON.parse(JSON.stringify(other)));
        }

        this._tableName = this.constructor.name;
    }

    static getListInsertPreStatement(list) {
        if (!list || list.length == 0) {
            return null;
        }

        let sampleObj = list[0];
        let placeholders = sampleObj.getQueryPlaceholders();

        return {
            statement:
                'INSERT INTO ' +
                sampleObj._tableName +
                '(' +
                sampleObj.getInsertQueryPropertyNames().join(', ') +
                ') VALUES ' +
                list.map((obj) => placeholders).join(', '),
            values: list.map((obj) => obj.getValues()),
        };
    }

    static getSelectPreStatement(fromType, query) {
        return {
            statement:
                'SELECT * FROM "' +
                fromType.name +
                '"' +
                (query ? ' WHERE ' + query.statement : ''),
            values: query ? query.values : [],
        };
    }

    static getDeletePreStatement(fromType, query) {
        return {
            statement:
                'DELETE FROM "' +
                fromType.name +
                '"' +
                (query ? ' WHERE ' + query.statement : ''),
            values: query ? query.values : [],
        };
    }

    getDeletePreStatement() {
        return {
            statement:
                'DELETE FROM "' +
                this._tableName +
                '"' +
                ' WHERE Id = ?',
            values: [this._id],
        };
    }

    getInsertPreStatement() {
        let properties = this.getProperties();
        let propertyNames = this.getInsertQueryPropertyNames(properties);
        let placeholders = this.getInsertQueryPlaceholders(properties);
        let propertyValues = this.getValues(properties);

        return {
            statement:
                'INSERT INTO "' + this._tableName + '" (' + propertyNames.join(', ') +
                ') VALUES ' +
                placeholders,
            values: propertyValues,
        };
    }

    getInsertQueryPropertyNames(properties) {
        if (!properties) {
            properties = this.getProperties();
        }
        return properties.map((p) => Object.keys(p)[0]);
    }

    getInsertQueryPlaceholders(properties) {
        if (!properties) {
            properties = this.getProperties();
        }
        let placeholders = properties.map((p) => '?').join(', ');
        return '(' + placeholders + ')';
    }

    getValues(properties) {
        if (!properties) {
            properties = this.getProperties();
        }
        return properties.map((p) => Object.values(p)[0]);
    }

    getUpdatePreStatement() {
        // Properties without Id itself
        let properties = this.getProperties().filter((p) => Object.keys(p)[0] != 'Id');

        let propertyNames = this.getInsertQueryPropertyNames(properties);
        let propertyValues = this.getValues(properties);

        let updatedValuesStrings = propertyNames.map((pn) => pn + ' = ?');

        return {
            statement:
                'UPDATE "' +
                this._tableName +
                '" SET ' +
                updatedValuesStrings.join(', ') +
                ' WHERE Id = ?',
            values: propertyValues.concat(this.Id),
        };
    }

    getOrNull(prop) {
        if (typeof prop !== 'undefined' && prop !== null) {
            return prop;
        } else {
            return null;
        }
    }

    getOrElse(prop, onElse) {
        if (typeof prop !== 'undefined' && prop !== null) {
            return prop;
        } else {
            return onElse;
        }
    }

    getProperties() {
        return this.getPropertiesRec(Object.getPrototypeOf(this));
    }

    getPropertiesRec(proto) {
        let result = [];
        // Termination
        if (proto.constructor.name != 'DBObject') {
            result = this.getPropertiesRec(Object.getPrototypeOf(proto));
        }

        return result.concat(this.listProperties(proto));
    }

    listProperties(proto) {
        return Object.entries(Object.getOwnPropertyDescriptors(proto))
            .filter(([key, descriptor]) => typeof descriptor.get === 'function')
            .map(([key]) => {
                let res = {};
                res[key] = this[key];
                return res;
            });
    }

    get Id() {
        return this._id;
    }

    set Id(value) {
        this._id = value;
    }
}

module.exports = DBObject;
