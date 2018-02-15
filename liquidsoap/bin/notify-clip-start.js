const getPartialCanonicalIdPath = require('./id-utils').getPartialCanonicalIdPath;
const findProgram = require('./id-utils').findProgram;

const fs = require('fs');
const path = require('path');

// path to the lineup file
let cwd = process.argv[2];
let mediaDir = process.argv[3];
let startedClip = process.argv[4];

/**
 * Checks if a program is started with this clip
 * @param {String} programIdPath the Id of the program being tested
 * @return {Program} the started program if any. returns null otherwise
 */
let isProgramStartedNow = (programIdPath) => {
    let lineupId = getPartialCanonicalIdPath(programIdPath, 'Lineup');
    try {
        let program = findProgram(liveLineup[lineupId], programIdPath);
        let programFirstClip = program.PreShow
            ? program.PreShow.Clips[0].Media.Path
            : program.Show.Clips[0].Media.Path;
        let cAbsolutePath = path.resolve(mediaDir, programFirstClip);
        if (cAbsolutePath == startedClip) {
            return true;
        }
    } catch (e) {
        // No problem, continue searching
    }
    return null;
};

// The rovolving lineup
let liveLineup = JSON.parse(fs.readFileSync(cwd + '/run/live/live-lineup.json'));

let startedProgramIdPath = null;
// In order, we check interrupting preshow and regular box
// playback to see what is being played. We don't care about interrupting show
// as interrupting program is actually started with preshow and not the show
let channels = [
    '/run/interrupting-preshow-playback.liquidsoap.lock',
    '/run/box-playback.liquidsoap.lock',
];

for (let channel of channels) {
    if (fs.existsSync(cwd + channel)) {
        let programIdPath = fs.readFileSync(
            cwd + '/run/interrupting-show-playback.liquidsoap.lock'
        );
        if (isProgramStartedNow(programIdPath)) {
            startedProgramIdPath = programIdPath;
            break;
        }
    }
}

let newLiveStatus = null;
if (startedProgramIdPath) {
    // OK. we found a match. do notify
    newLiveStatus = {
        MostRecentProgram: startedProgramIdPath,
        IsCurrentlyPlaying: true,
    };
} else if (startedClip.contains('/no-program.mp3')) {
    // Program playback ended. Keep the most recent program, end playback
    if (fs.existsSync(cwd + '/run/live/status.json')) {
        newLiveStatus = JSON.parse(fs.readFileSync(cwd + '/run/live/status.json'));
    }
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
