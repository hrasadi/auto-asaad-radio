const fs = require('fs');

// path to the lineup file
let cwd = process.argv[2];
// let mediaDir = process.argv[3];
let startedClipAbsolutePath = process.argv[4];

// check two queues
let preshowShadowQueue = PlaybackClipQueue.buildQueue(
    cwd + '/run/liquidsoap/interrupting-preshow-clips.liquidsoap.queue'
);
let boxshadowQueue = PlaybackClipQueue.buildQueue(
    cwd + '/run/liquidsoap/box-clips.liquidsoap.queue'
);

let liveStatus = {};
if (fs.existsSync(cwd + '/run/live/status.json')) {
    liveStatus = JSON.parse(
        fs.readFileSync(cwd + '/run/live/status.json', 'utf-8')
    );
}

if (preshowShadowQueue.peakClip() === startedClipAbsolutePath) {
    // Found! dequeue and notify
    preshowShadowQueue.
}

let newLiveStatus = null;
if (startedProgramIdPath) {
    // OK. we found a match. do notify
    newLiveStatus = {
        MostRecentProgram: startedProgramIdPath,
        IsCurrentlyPlaying: true,
    };
} else if (startedClip.indexOf('/no-program.mp3') != -1) {
    // Program playback ended. Keep the most recent program, end playback
    newLiveStatus.IsCurrentlyPlaying = false;
} // else nothing new happened. Do nothing

if (newLiveStatus) {
    fs.writeFileSync(cwd + '/run/live/status.json', JSON.stringify(newLiveStatus));
}

// console.log(status.currentProgram);
// if (customApplicationHandler) {
//   if (status.currentProgram != oldStatus.currentProgram) {
//     customApplicationHandler.perform(status.currentProgram, status.currentClip);
//   }
// }
