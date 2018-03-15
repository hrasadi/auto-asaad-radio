const Database = require('better-sqlite3');

class SyncDB {
    constructor(dbPath) {
        this._db = new Database(dbPath);
    }

    runSync(stmt, values) {
        this._db.prepare(stmt).run(values);
    }

    getSync(stmt, values) {
        return this._db.prepare(stmt).get(values);
    }

    allSync(stmt, values) {
        return this._db.prepare(stmt).all(values);
    }

    eachSync(stmt, values, callback) {
        let rows = this.allSync(stmt, values);
        for (let row of rows) {
            callback(row);
        }
    }

    close() {
        this._db.close();
    }
}

module.exports = SyncDB;
