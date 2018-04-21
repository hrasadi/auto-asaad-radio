const AWS = require('aws-sdk');
const fs = require('fs');
const program = require('commander');

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

        this._s3.putObject(params, (err, data) => {
            if (err) {
                console.log(
                    'Error uploading file to S3. Error is: ' + err
                );
            } else {
                console.log(
                    'Successfully uploaded item to S3: ' + this._key
                );
            }
        });
    }
}

/* === Entry Point === */
program.version('1.0.0').parse(process.argv);

if (program.args.length < 3) {
    console.log(
        'Usage: node s3-put-object.js {conf-path} {bucket} {key} {file-path}'
    );
    process.exit(1);
}

new S3ObjectUploader(program).init();
