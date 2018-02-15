const findProgram = require('./id-utils').findProgram;

const fs = require('fs');

const cwd = process.argv[2];
// path to the lineup file
const lineupFilePath = process.argv[3];
const programCanonicalIdPath = process.argv[4];

if (fs.existsSync(lineupFilePath)) {
    let lineup = JSON.parse(fs.readFileSync(lineupFilePath, 'utf8'));

    // find the program
    let program = findProgram(lineup, programCanonicalIdPath);

    for (let clip of program.PreShow.Clips) {
        console.log(clip.Media.Path);
    }

    if (program.PreShow.FillerClip) {
        // Also, save the preshow filler media, so that it could be accessed later
        // by liquidsoap
        fs.writeFile(
            cwd + '/run/interrupting-preshow-filler.liquidsoap.lock',
            program.PreShow.FillerClip.Media.Path,
            () => {}
        );
    }
} else {
    throw Error(`Fatal error! Cannot find lineup ${lineupFilePath}`);
}
