const PlaybackClipQueue = require('../PlaybackClipQueue').PlaybackClipQueue;

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

if (preshowShadowQueue.peakClip().ClipAbsolutePath === startedClipAbsolutePath) {
    // Found! dequeue and notify
    let clip = preshowShadowQueue.dequeueClip();
    if (clip.MarksStartOfProgram) {
        liveStatus.IsCurrentlyPlaying = true;
        liveStatus.MostRecentProgram = clip.MarksStartOfProgram;
        // TODO: notify
    }
} else if (boxshadowQueue.peakClip().ClipAbsolutePath === startedClipAbsolutePath) {
    // Found! dequeue and notify
    let clip = boxshadowQueue.dequeueClip();
    if (clip.MarksStartOfProgram) {
        liveStatus.IsCurrentlyPlaying = true;
        liveStatus.MostRecentProgram = clip.MarksStartOfProgram;
        // TODO: notify
    }
} else if (startedClipAbsolutePath.indexOf('/no-program.mp3') != -1) {
    // playback stopped
    liveStatus.IsCurrentlyPlaying = false;
} // Else, propably a clip from interrupting show is started (we can improve here!)

fs.writeFileSync(cwd + '/run/live/status.json', JSON.stringify(liveStatus));
