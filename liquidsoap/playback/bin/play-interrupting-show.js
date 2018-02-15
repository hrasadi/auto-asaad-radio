const P = require('../PlaybackClipQueue');

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

        program.PreShow.Clips.forEach((clip, index) => {
            // Enqueue in our shadowQueue
            pushToLiquidsoapQueue('interrupting_show_q', clip.Media.Path);
        });

        // start playback of the preshow
        execCustomLiquidsoapCommand('var.set interrupting_preshow_enabled = false');
    } else {
        throw Error(`Fatal error! Cannot find lineup ${lineupFilePath}`);
    }
};

// Precise start of the target minute
let schedule = async () => {
    await delay(200); // Avoid running on xx:59, if cron starts immediately.
    let secondsToGo = 60 - moment().seconds();
    await delay(secondsToGo * 100); // to millis

    // Time to fire!
    queueClipsForPlayback();
};

schedule();
