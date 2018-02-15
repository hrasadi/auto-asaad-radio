const findBox = require('./id-utils').findBox;

const fs = require('fs');

// const cwd = process.argv[2];
// path to the lineup file
const lineupFilePath = process.argv[3];
const boxCanonicalIdPath = process.argv[4];


if (fs.existsSync(lineupFilePath)) {
    let lineup = JSON.parse(fs.readFileSync(lineupFilePath, 'utf8'));

    // find the box
    let box = findBox(lineup, boxCanonicalIdPath);

    for (let program of box.Programs) {
        for (let clip of program.Show.Clips) {
            console.log(clip.Media.Path);
        }
    }
} else {
    throw Error(`Fatal error! Cannot find lineup ${lineupFilePath}`);
}
