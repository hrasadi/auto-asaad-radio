const AWS = require('aws-sdk');
const program = require('commander');

class S3ObjectExistanceChecker {
    constructor(program) {
        AWS.config.loadFromPath(program.args[0]);
        this._s3 = new AWS.S3();
        this._bucket = program.args[1];
        this._key = program.args[2];
    }

    init() {
        let params = {
            Bucket: this._bucket,
            Key: this._key,
        };

        this._s3.headObject(params, (err, metadata) => {
            if (err && err.code === 'NotFound') {
                console.log('NotExists');
                process.exit(1);
            } else if (!err) {
                console.log('Exists');
                process.exit(0);
            } else {
                console.log('Error: ' + err);
                process.exit(-1);
            }
        });
    }
}

/* === Entry Point === */
program.version('1.0.0').parse(process.argv);

if (program.args.length < 2) {
    console.log(
        'Usage: node s3-check-exists.js {conf-path} {bucket} {key}'
    );
    process.exit(1);
}

new S3ObjectExistanceChecker(program).init();
