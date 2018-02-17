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

        // Enqueue in our shadowQueue
        pushToLiquidsoapQueue(
            'interrupting_show_q',
            program.Show.Clips.map((clip) => clip.Media.Path)
        );

        // start playback of the preshow
        execCustomLiquidsoapCommand('var.set interrupting_preshow_enabled = false');
        execCustomLiquidsoapCommand('interrupting_preshow_filler.removeall()');
        // We no longer need this file. By removing it, we prevent liquidsoap
        // from pushing extra instances into the queue
        fs.unlinkSync(cwd + '/run/liquidsoap/interrupting-preshow-filler.lock');
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
