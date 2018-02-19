const PlaybackClipQueue = require('../PlaybackClipQueue').PlaybackClipQueue;

const fs = require('fs');

// path to the lineup file
let cwd = process.argv[2];
// let mediaDir = process.argv[3];
let startedClipAbsolutePath = process.argv[4];

if (!startedClipAbsolutePath) {
    process.exit(0);
}

// check two queues
let preShowShadowQueue = PlaybackClipQueue.buildQueue(
    cwd + '/run/liquidsoap/interrupting-preshow-clips.liquidsoap.queue'
);
let boxShadowQueue = PlaybackClipQueue.buildQueue(
    cwd + '/run/liquidsoap/box-clips.liquidsoap.queue'
);

let liveStatus = {};
if (fs.existsSync(cwd + '/run/live/status.json')) {
    liveStatus = JSON.parse(fs.readFileSync(cwd + '/run/live/status.json', 'utf-8'));
}

if (
    preShowShadowQueue.peakClip() &&
    preShowShadowQueue.peakClip().ClipAbsolutePath === startedClipAbsolutePath
) {
    // Found! dequeue and notify
    let clip = preShowShadowQueue.dequeueClip();
    preShowShadowQueue.persist();
    if (clip.MarksStartOfProgram) {
        liveStatus.IsCurrentlyPlaying = true;
        liveStatus.MostRecentProgram = clip.MarksStartOfProgram;
        liveStatus.StartedProgramTitle = clip.StartedProgramTitle;

        notifyProgrmStart(liveStatus);
    }
} else if (
    boxShadowQueue.peakClip() &&
    boxShadowQueue.peakClip().ClipAbsolutePath === startedClipAbsolutePath
) {
    // Found! dequeue and notify
    let clip = boxShadowQueue.dequeueClip();
    boxShadowQueue.persist();
    if (clip.MarksStartOfProgram) {
        liveStatus.IsCurrentlyPlaying = true;
        liveStatus.MostRecentProgram = clip.MarksStartOfProgram;
        liveStatus.StartedProgramTitle = clip.StartedProgramTitle;

        notifyProgrmStart(liveStatus);
    }
} else if (startedClipAbsolutePath.indexOf('/no-program.mp3') != -1) {
    // playback stopped
    // TODO: notify end of playback
    liveStatus.IsCurrentlyPlaying = false;
} // Else, propably a clip from interrupting show is started (we can improve here!)

fs.writeFileSync(cwd + '/run/live/status.json', JSON.stringify(liveStatus));

function notifyProgrmStart(liveStatus) {
    if (fs.existsSync(cwd + '/liquidsoap-handlers/notify-clip-start.js')) {
        let handler = require(cwd + '/liquidsoap-handlers/notify-clip-start');
        handler(cwd, liveStatus);
    }
}
