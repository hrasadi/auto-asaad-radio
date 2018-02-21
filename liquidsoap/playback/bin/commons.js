const Telnet = require('telnet-client');

let delay = (timeout) => {
    return new Promise((resolve) => setTimeout(resolve, timeout));
};

let telnetParams = {
    host: 'localhost',
    negotiationMandatory: false,
    shellPrompt: '',
    port: 1221,
    timeout: 1500,
};

let execCustomLiquidsoapCommand = async (cmd) => {
    let connection = new Telnet();
    try {
        await connection.connect(telnetParams);
        await connection.exec(cmd);
        connection.end();
    } catch (e) {
        console.log(e);
    }
};

let pushToLiquidsoapQueue = async (queueName, clipsFilePath) => {
    let connection = new Telnet();
    try {
        await connection.connect(telnetParams);
        for (let clipFilePath of clipsFilePath) {
            await connection.exec(queueName + '.push ' + clipFilePath);
        }
        // Wait for things to sink in
        await delay(1000);
        connection.end();
    } catch (e) {
        console.log(e);
    }
};

module.exports = {
    'delay': delay,
    'pushToLiquidsoapQueue': pushToLiquidsoapQueue,
    'execCustomLiquidsoapCommand': execCustomLiquidsoapCommand,
};
