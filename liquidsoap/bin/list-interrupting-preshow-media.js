const getPartialCanonicalIdPath = require('./id-utils').getPartialCanonicalIdPath;

const fs = require('fs');

// const cwd = process.argv[2];
// path to the lineup file
const lineupFilePath = process.argv[3];
const programCanonicalIdPath = process.argv[4];

let findbox = (lineup, boxCanonicalIdPath) => {
    let box = lineup.Boxes.find((box) => {
        box.CanonicalIdPath == boxCanonicalIdPath;
    });

    if (!box) {
        throw Error(`Box ${boxCanonicalIdPath} not found!`);
    }
    return box;
};

let findProgram = (lineup, programCanonicalIdPath) => {
    let box = findbox(lineup, getPartialCanonicalIdPath(programCanonicalIdPath, 'Box'));
    let program = box.find((program) => {
        program.CanonicalIdPath == programCanonicalIdPath;
    });

    if (!program) {
        throw Error(`Program ${programCanonicalIdPath} not found!`);
    }
    return program;
};

if (fs.existsSync(lineupFilePath)) {
    let lineup = JSON.parse(fs.readFileSync(lineupFilePath, 'utf8'));

    // find the box
    let box = findProgram(lineup, programCanonicalIdPath);

    for (let program of box.Programs) {
        for (let clip of program.PreShow.Clips) {
            console.log(clip.Media.Path);
        }
    }
} else { // LineupFilePath not accessible, maybe radio is not up yet
    setTimeout(function() {
        process.exit(0);
    }, 1000);
}