const IdLevel = {
    Lineup: 1,
    Box: 2,
    Program: 3,
};

class IdUtils {
    static getPartialCanonicalIdPath(fromIdPath, level) {
        let components = fromIdPath.split('/');
        if (components.length < IdLevel[level]) {
            throw Error(
                'The provided IdPath is not detailed enough to extract ' +
                    level +
                    ' level path from it.'
            );
        }
        // form the desired path
        return components.slice(0, IdLevel[level]).join('/');
    }

    static findBox(lineup, boxCanonicalIdPath) {
        let box = lineup.Boxes.find((box) => {
            return box.CanonicalIdPath == boxCanonicalIdPath;
        });
        if (!box) {
            throw Error(`Box ${boxCanonicalIdPath} not found!`);
        }
        return box;
    }

    static findProgram(lineup, programCanonicalIdPath) {
        let box = IdUtils.findBox(
            lineup,
            IdUtils.getPartialCanonicalIdPath(programCanonicalIdPath, 'Box')
        );
        let program = box.Programs.find((program) => {
            return program.CanonicalIdPath == programCanonicalIdPath;
        });
        if (!program) {
            throw Error(`Program ${programCanonicalIdPath} not found!`);
        }
        return program;
    }
}

module.exports = IdUtils;
