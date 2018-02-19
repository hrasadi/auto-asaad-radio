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

let queueClipsForPlayback = async () => {
    if (fs.existsSync(lineupFilePath)) {
        let lineup = JSON.parse(fs.readFileSync(lineupFilePath, 'utf8'));
        // find the program
        let program = IdUtils.findProgram(lineup, programCanonicalIdPath);

        // Enqueue in our shadowQueue
        pushToLiquidsoapQueue(
            'interrupting_show_q',
            program.Show.Clips.map((clip) => clip.Media.Path)
        );

        // Let things sync in and show playback starts before making changes in queue
        await delay(2000);

        // start playback of the preshow
        execCustomLiquidsoapCommand('var.set interrupting_preshow_enabled = false');
        // remove all queued filler clips (and preshow)
        execCustomLiquidsoapCommand('interrupting_preshow_filler.removeall');
        execCustomLiquidsoapCommand('interrupting_preshow_q.removeall');
    } else {
        throw Error(`Fatal error! Cannot find lineup ${lineupFilePath}`);
    }
};

// Precise start of the target minute
let schedule = async () => {
    await delay(2000); // Avoid running on xx:59, if cron starts immediately.
    let secondsToGo = 60 - moment().seconds();
    await delay(secondsToGo * 1000); // to millis

    // Time to fire!
    queueClipsForPlayback();
};

schedule();
