const fs = require('fs');

const cwd = process.argv[2];

if (fs.existsSync(cwd + '/run/liquidsoap/interrupting-preshow-clips.liquidsoap.queue')) {
    fs.unlinkSync(cwd + '/run/liquidsoap/interrupting-preshow-clips.liquidsoap.queue');
}
if (fs.existsSync(cwd + '/run/liquidsoap/box-clips.liquidsoap.queue')) {
    fs.unlinkSync(cwd + '/run/liquidsoap/box-clips.liquidsoap.queue');
}
