import AWS from 'aws-sdk';
import fs from 'fs';
import program from 'commander';

class S3ObjectUploader {
    constructor(program) {
        AWS.config.loadFromPath(program.args[0]);
        this._bucket = program.args[1];
        this._key = program.args[2];
        this._filePath = program.args[3];
    }

    init() {
        let params = {
            Bucket: this._bucket,
            Key: this._key,
        };

        params.Body = fs.readFileSync(this._filePath);

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

if (program.args.length < 3) {
    console.log(
        'Usage: node s3-put-object.js {conf-path} {bucket} {key}'
    );
    process.exit(1);
}

new S3ObjectUploader(program).init();
