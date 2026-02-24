"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComPort = void 0;
exports.enableDebug = enableDebug;
const serialport_1 = require("serialport");
const ComMacro_1 = require("./ComMacro");
// TODO: Adopt a propper logging system.
let debug;
function enableDebug(enable = true) {
    if (enable) {
        debug = console.log;
    }
    else {
        debug = () => { };
    }
}
enableDebug(false);
/**
 * Represents a serial communication port. This class is responsible for managing the connection to the port, sending commands, and reading responses. It also
 * maintains the state of the port (e.g. whether it is currently busy or available)
 * and handles incoming data and errors.
 *
 * The port will be busy while waiting for a response to a sent command, and will be available for new commands once the response is received or an error occurs.
 * While waiting for a new command, the port will be in the background state, allowing it to log incoming data without blocking.
 * If an error occurs while waiting for a response, the port will return to the background state and log the error.
 *
 * Valid states: busy, closed, background, connecting.
 */
class ComPort {
    constructor(path) {
        this.path = path;
        this.port = null;
        this.readComplete = false;
        this.buffer = ''; // TODO replace with Buffer
        this.backgroundBuffer = [];
        this.name = null;
        this.state = 'closed';
        this.type = null;
        this.lastError = null;
        this.timeout = 5000; // TODO: Allow setting this at the service level and at the method level.
        this.lineEnding = '\n'; // TODO: Allow setting this at the service level and at the method level.
    }
    toString() {
        return `ComPort(path=${this.path}, state=${this.state}${this.type ? ', type=' : ''}${this.type ? this.type?.name : ''}${this.lastError ? ', lastError=' : ''}${this.lastError ? this.lastError : ''})`;
    }
    async setType(type) {
        try {
            await this.connect(type.baud, type.startupDelay); // throws an error if connection fails
            await this.send(type.macros.init);
            if (this.readComplete) {
                this.type = type;
                return true;
            }
            else {
                return false;
            }
        }
        finally {
            await this.close();
        }
    }
    /**
     * Opens the serial port with either the given baud rate or the baud rate
     * set in the ComPort's type. Once successfully open the port will be in
     * the background state and may be used to write and read.
     * @param baud The Baud rate.
     * @param startupDelay Optional delay in milliseconds to wait after opening before resolving.
     * @returns A Promise.
     */
    async connect(baud, startupDelay) {
        if (!baud && !this.type) {
            throw new Error('No baud rate set while trying to connect. Either pass the baud rate to the connect function or set a ComType first.');
        }
        if (!baud) {
            baud = this.type.baud;
        }
        this.state = 'connecting';
        this.port = new serialport_1.SerialPort({
            path: this.path,
            baudRate: baud,
            autoOpen: false
        });
        this.port.on('error', this.receiveError.bind(this));
        this.port.on('data', this.receiveData.bind(this));
        return new Promise((resolve, reject) => {
            this.port.open((err) => {
                if (err) {
                    this.state = 'closed';
                    this.lastError = err.message;
                    reject(err);
                    return;
                }
                // Successfully opened:
                debug(`Connected to com port ${this.path}.`);
                const delay = startupDelay ?? this.type?.startupDelay;
                if (delay) {
                    setTimeout(() => {
                        this.state = 'background';
                        resolve();
                    }, delay); // wait for device to startup if needed
                }
                else {
                    this.state = 'background';
                    resolve();
                }
            });
        });
    }
    /**
     * Read from the serial port until either the given pattern is
     * matched in the read data or the ComPort's timeout is reached.
     * @param match The RegExp to match against read data.
     * @returns The read data.
     */
    async read(match) {
        let time = Date.now();
        this.readMatch = match;
        this.buffer = '';
        this.lastError = null;
        this.readComplete = false;
        return new Promise((resolve, reject) => {
            const checkCompletion = () => {
                if (this.readComplete) {
                    resolve(this.buffer.trim());
                }
                else if (Date.now() - time > this.timeout) {
                    reject(new Error(`Timeout after ${this.timeout}ms while reading from port ${this.path}.`)); // TODO: Create custom timeout error class.
                }
                else if (this.lastError) {
                    reject(new Error(this.lastError));
                }
                else {
                    setTimeout(() => {
                        checkCompletion();
                    }, 100);
                }
            };
            checkCompletion();
        });
    }
    /**
     * Writes the given command string to the serial port.
     * @param command The command to write.
     * @returns A Promise.
     */
    async write(command) {
        if (!this.port || !this.port.isOpen) {
            throw new Error('Port not open. Please open the port via the connect function before attempting to write.');
        }
        // Asynchronously write data to the port:
        return new Promise((resolve, reject) => {
            this.port.write(command + this.lineEnding, (err) => {
                if (err) {
                    this.lastError = err.message;
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }
    /**
     * Closes the port. If successfully closed, the port's state will
     * be closed.
     * @returns A Promise.
     */
    async close() {
        return new Promise((resolve, reject) => {
            this.port?.close((err) => {
                if (!this.port.isOpen) {
                    this.port = null;
                    this.state = 'closed';
                }
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }
    /**
     * Attempts to set the port state to busy.
     * If the port is currently closed, it will attempt to connect.
     * If the port is currently connecting, it will wait until the connection is complete.
     * If the port is currently busy, it will wait until the port becomes available.
     * If the port does not become available within a certain time frame, an error will be thrown.
     * @returns
     */
    async lockPort() {
        // Already available:
        if (this.state === 'background') {
            this.state = 'busy';
            return;
        }
        // If port is not connected then connect:
        if (this.state === 'closed') {
            debug(`Port ${this.path} is closed - connecting...`);
            await this.connect();
        }
        // If currently connecting, first wait until connected:
        const MAX_ATTEMPTS = 10;
        let attempt = 0;
        while (this.state === 'connecting' && attempt < MAX_ATTEMPTS) {
            await new Promise(resolve => setTimeout(() => resolve(), this.timeout / MAX_ATTEMPTS));
            attempt++;
        }
        if (this.state === 'connecting') {
            throw new Error(`Timeout while waiting for connection to complete.`);
        }
        debug(`Port ${this.path} connected.`);
        // If busy, wait until available:
        attempt = 0;
        while (this.state === 'busy' && attempt < MAX_ATTEMPTS) {
            debug(`Port ${this.path} is busy - waiting...`);
            await new Promise(resolve => setTimeout(() => resolve(), this.timeout / MAX_ATTEMPTS));
            attempt++;
        }
        if (this.state === 'busy') {
            throw new Error(`Timeout while waiting for port to become available.`);
        }
        this.state = 'busy';
        debug(`Port ${this.path} is now available.`);
    }
    async send(macros_operationId, params) {
        if (typeof macros_operationId === 'string') {
            if (!this.type) {
                throw new Error(`Cannot send to com port ${this.path} by operationId without a type.`);
            }
            debug(`Sending macros for operationId '${macros_operationId}' on port ${this.path}.`);
            return this.send(this.type.macros[macros_operationId], params);
        }
        if (!macros_operationId || macros_operationId.length === 0) {
            throw new Error(`No macros provided to send to com port ${this.path}.`);
        }
        let macros = macros_operationId;
        // Replace parameters in each macro command:
        if (params) {
            macros = macros.map(m => {
                let command = m.command;
                // Extract all parameters in the command.
                // These have the form {param}:
                const paramRegex = /{([^}]+)}/gm;
                let match;
                const commandParams = [];
                while ((match = paramRegex.exec(command)) !== null) {
                    // This is necessary to avoid infinite loops with zero-width matches
                    if (match.index === paramRegex.lastIndex) {
                        paramRegex.lastIndex++;
                    }
                    // The result can be accessed through the 'match'-variable.
                    match.forEach((m, groupIndex) => {
                        if (groupIndex === 1) {
                            commandParams.push(m);
                        }
                    });
                }
                // Replace each parameter with its value:
                commandParams.forEach(p => {
                    const re = new RegExp(`{${p}}`, 'g');
                    let val;
                    // Resolve nested parameters:
                    if (p.includes('.')) {
                        val = params[p.substring(0, p.indexOf('.'))]; // get top-level value
                        const keys = p.split('.');
                        for (let key of keys) {
                            // Check for the property:
                            if (val && val.hasOwnProperty(key)) {
                                val = val[key];
                            }
                            // Check if the property has an array index:
                            else if (key.endsWith(']') && key.includes('[')) {
                                const arrKey = key.substring(0, key.indexOf('['));
                                const indexStr = key.substring(key.indexOf('[') + 1, key.length - 1);
                                const index = parseInt(indexStr);
                                if (val && val.hasOwnProperty(arrKey) && Array.isArray(val[arrKey]) && val[arrKey].length > index) {
                                    val = val[arrKey][index];
                                }
                            }
                            // else not found.
                        }
                    }
                    else {
                        val = params[p];
                    }
                    command = command.replaceAll(re, val);
                });
                return new ComMacro_1.ComMacro(command, m.response);
            });
        }
        // Execute each macro in turn:
        const responses = [];
        for (let macro of macros) {
            // Wait for port the become available:
            try {
                await this.lockPort();
            }
            catch (err) {
                debug(`Error while waiting for port ${this.path} to become available for command '${macro.command}': ${err?.message || err}`);
                this.state = 'background'; // Return to background state to allow logging of incoming data and future requests.
                throw err;
            }
            // Write the command and wait for the response:
            try {
                await this.write(macro.command);
                const response = await this.read(macro.response);
                responses.push(response);
            }
            catch (err) {
                debug(`Error while sending command '${macro.command}' to port ${this.path}: ${err?.message || err}`);
                this.state = 'background'; // Return to background state to allow logging of incoming data and future requests.
                throw err;
            }
        }
        return responses;
    }
    receiveError(err) {
        console.error(`Error on port ${this.path}: ${err.message}`);
        this.lastError = err.message;
        if (this.port?.isOpen) {
            // If the error did not close the port, then return to background processing:
            this.state = 'background';
        }
        else {
            // If the error closed the port, then set state to closed
            // and remove the SerialPort if needed:
            this.state = 'closed';
            if (this.port) {
                this.close();
            }
        }
    }
    receiveData(data) {
        // Background Log:
        if (this.state === 'background') {
            const dataStr = data.toString();
            const lines = dataStr.split(/\r?\n/);
            if (lines.length > 0) {
                // Append to the last entry to ensure incompelte lines are joined:
                if (this.backgroundBuffer.length > 0) {
                    this.backgroundBuffer[this.backgroundBuffer.length - 1] += lines[0];
                }
                else {
                    this.backgroundBuffer.push(lines[0]);
                }
                // Add remaining lines as new entries:
                for (let i = 1; i < lines.length; i++) {
                    if (lines[i].trim().length > 0) {
                        this.backgroundBuffer.push(lines[i]);
                    }
                }
                // If the data string ends with a line ending, then
                // add an empty line to represent the new line:
                if (dataStr.endsWith('\n') || dataStr.endsWith('\r')) {
                    this.backgroundBuffer.push('');
                }
            }
            // Limit background buffer size:
            if (this.backgroundBuffer.length > 1000) {
                this.backgroundBuffer.splice(this.backgroundBuffer.length - 10, 10);
            }
            return;
        }
        // Read until pattern matched:
        if (this.state === 'busy') {
            if (!this.readMatch) {
                this.lastError = 'State was busy reading data but no read RegExp was found to check for completion.';
                this.state = 'background';
                return;
            }
            this.buffer += data.toString();
            this.readMatch.lastIndex = 0;
            const matches = this.readMatch.test(this.buffer.toString().trim());
            if (matches) {
                this.state = 'background';
                this.readComplete = true;
            }
        }
        else {
            console.error(`Port ${this.path} received data in unexpected state '${this.state}': ${data.toString()}`);
        }
    }
}
exports.ComPort = ComPort;
async function sleep(startupDelay) {
    return new Promise(resolve => setTimeout(() => resolve(), startupDelay));
}
//# sourceMappingURL=ComPort.js.map