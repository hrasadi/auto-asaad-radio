const Database = require('better-sqlite3');

class SyncDB {
    constructor(dbPath) {
        this._db = new Database(dbPath);
    }

    runSync(stmt, values) {
        let ps = this._db.prepare(stmt);
        if (values) {
            return ps.run(values);
        } else {
            return ps.run();
        }
    }

    getSync(stmt, values) {
        let ps = this._db.prepare(stmt);
        if (values) {
            return ps.get(values);
        } else {
            return ps.get();
        }
    }

    allSync(stmt, values) {
        let ps = this._db.prepare(stmt);
        if (values) {
            return ps.all(values);
        } else {
            return ps.all();
        }
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
