const P = require('../PlaybackClipQueue');
const PlaybackClipQueue = P.PlaybackClipQueue;
const PlaybackClip = P.PlaybackClip;

const IdUtils = require('../IdUtils');
const delay = require('./commons').delay;
const pushToLiquidsoapQueue = require('./commons').pushToLiquidsoapQueue;
const execCustomLiquidsoapCommand = require('./commons').execCustomLiquidsoapCommand;

const fs = require('fs');
const moment = require('moment');

const cwd = process.argv[2];
// path to the lineup file
const lineupFilePath = process.argv[3];
const programCanonicalIdPath = process.argv[4];

let queueClipsForPlayback = () => {
    if (fs.existsSync(lineupFilePath)) {
        let lineup = JSON.parse(fs.readFileSync(lineupFilePath, 'utf8'));
        // find the program
        let program = IdUtils.findProgram(lineup, programCanonicalIdPath);

        // Skip current liquidsoap queue item
        execCustomLiquidsoapCommand('interrupting_preshow_q.skip');

        let shadowQueue = PlaybackClipQueue.buildQueue(
            cwd + '/run/liquidsoap/interrupting-preshow-clips.liquidsoap.queue'
        );
        program.PreShow.Clips.forEach((clip, index) => {
            // Enqueue in our shadowQueue
            let playbackClip = new PlaybackClip();
            playbackClip.ClipAbsolutePath = clip.Media.Path;
            playbackClip.MarksStartOfProgram =
                index == 0 ? program.CanonicalIdPath : null;

            shadowQueue.enqueueClip(playbackClip);

            pushToLiquidsoapQueue('interrupting_preshow_q', clip.Media.Path);
        });

        // Commit changes
        shadowQueue.persist();

        if (program.PreShow.FillerClip) {
            // Also, save the preshow filler media, so that it could be accessed later
            // by liquidsoap
            fs.writeFile(
                cwd + '/run/liquidsoap/interrupting-preshow-filler.lock',
                program.PreShow.FillerClip.Media.Path,
                () => {}
            );
        }

        // start playback of the preshow
        execCustomLiquidsoapCommand('var.set interrupting_preshow_enabled = true');
    } else {
        throw Error(`Fatal error! Cannot find lineup ${lineupFilePath}`);
    }
};

// Precise start of the target minute
let schedule = async () => {
    await delay(2); // Avoid running on xx:59, if cron starts immediately.
    let secondsToGo = 60 - moment().seconds();
    await delay(secondsToGo);

    // Time to fire!
    queueClipsForPlayback();
};

schedule();
