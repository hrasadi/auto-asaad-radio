const fs = require('fs');

const cwd = process.argv[2];

let fillerClipLockFilePath = cwd + '/run/liquidsoap/interrupting-preshow-filler.lock';

// path to the current (or most recent) filler clip lock file
if (fs.existsSync(fillerClipLockFilePath)) {
    let fillerItem = fs.readFileSync(fillerClipLockFilePath, 'utf8');
    console.log(fillerItem);
}
// else print nothing, no filler available (no preshow in progress or finished before)
// Stall liquidsoap for a bit, as it is very regularly call us!
setTimeout(() => {}, 5000);

