const Telnet = require('telnet-client');

let delay = (timeout) => {
    return new Promise((resolve) => setTimeout(resolve, timeout));
};

let execCustomLiquidsoapCommand = async (cmd) => {
    let connection = new Telnet();

    let params = {
        host: 'localhost',
        negotiationMandatory: false,
        shellPrompt: '',
        port: 1221,
        timeout: 1500,
    };

    try {
        await connection.connect(params);
        await connection.exec(cmd);
        connection.end();
    } catch (e) {
        console.log(e);
    }
};

let pushToLiquidsoapQueue = async (queueName, clipFilePath) => {
    await execCustomLiquidsoapCommand(queueName + '.push ' + clipFilePath);
};

module.exports = {
    delay: delay,
    pushToLiquidsoapQueue: pushToLiquidsoapQueue,
};
