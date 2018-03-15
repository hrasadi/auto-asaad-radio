const Database = require('better-sqlite3');

class SyncDB {
    constructor(dbPath) {
        this._db = new Database(dbPath);
    }

    runSync(stmt, values) {
        let ps = this._db.prepare(stmt);
        if (values) {
            ps.run(values);
        } else {
            ps.run();
        }
    }

    getSync(stmt, values) {
        let ps = this._db.prepare(stmt);
        if (values) {
            ps.get(values);
        } else {
            ps.get();
        }
    }

    allSync(stmt, values) {
        let ps = this._db.prepare(stmt);
        if (values) {
            ps.all(values);
        } else {
            ps.all();
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
