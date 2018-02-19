const AppContext = require('../AppContext');

const AsyncDB = require('../AsyncDB');

const DBObject = require('./DBObject');

class DBProvider {
    constructor(dbFileName) {
        this._dbFileName = dbFileName;
    }

    // implemented in subclasses
    init() {}

    // implemented in subclasses
    init1() {}

    init0() {
        let self = this;
        return new AsyncDB(
            AppContext.getInstance().CWD + '/run/db/' + this._dbFileName
        ).then((db) => {
            self._db = db;
        });
    }

    // implemented in subclasses
    shutdown() {
        this.shutdown0();
    }

    shutdown0() {
        this._db.close();
    }

    persist(dbObject) {
        let query = dbObject.getInsertPreStatement();
        return this._db.runAsync(query.statement, query.values);
    }

    async persistOrUpdate(dbObject) {
        let existsQuery = DBObject.getSelectPreStatement(dbObject.constructor.name, {
            statement: 'Id = ?',
            values: dbObject.Id,
        });
        let persistedObject = await this._db.getAsync(
            existsQuery.statement,
            existsQuery.values
        );

        if (persistedObject) {
            return this.update(dbObject);
        } else {
            return this.persist(dbObject);
        }
    }

    persistList(dbObjects) {
        let query = DBObject.getListInsertPreStatement(dbObjects);
        return this._db.runAsync(query.statement, query.values);
    }

    update(dbObject) {
        let query = dbObject.getUpdatePreStatement();
        return this._db.runAsync(query.statement, query.values);
    }

    unpersist(dbObject) {
        let query = dbObject.getDeletePreStatement();
        return this._db.runAsync(query.statement, query.values);
    }

    unpersistById(fromType, id) {
        let query = DBObject.getDeletePreStatement(fromType, {
            statement: 'Id = ?',
            values: id,
        });
        return this._db.runAsync(query.statement, query.values);
    }

    loadById(fromType, id) {
        let query = DBObject.getSelectPreStatement(fromType, {
            statement: 'Id = ?',
            values: id,
        });
        return this._db.getAsync(query.statement, query.values);
    }

    /**
     * DO NOT CALL DB FUNCTION IN THE 'OnRow' CALLBACK.
     * @param {Sring} fromType type
     * @param {Object} whereClause query
     * @param {Function} onRow DO NOT CALL DB FUNCTION IN THE 'ONROW' CALLBACK.
     * @return {Promise} The promise with the number of rows effected
     */
    entryListForEach(fromType, whereClause, onRow) {
        let query = DBObject.getSelectPreStatement(fromType, whereClause);
        return this._db.eachAsync(query.statement, query.values, onRow);
    }

    entryListAll(fromType, whereClause) {
        let query = DBObject.getSelectPreStatement(fromType, whereClause);
        return this._db.allAsync(query.statement, query.values);
    }
}

module.exports = DBProvider;
