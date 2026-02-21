import { SerialPort } from 'serialport';
import { ComMacro } from './ComMacro';
import { ComType } from './ComType';

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
export class ComPort {
    private port: SerialPort | null = null
    private readMatch?: RegExp
    private readComplete = false
    private buffer: string = '' // TODO replace with Buffer

    backgroundBuffer: string[] = [];

    name: string | null = null
    state: 'busy' | 'closed' | 'background' | 'connecting' = 'closed'
    type: ComType | null = null
    lastError: string | null = null
    timeout: number = 5000 // TODO: Allow setting this at the service level and at the method level.
    lineEnding: string = '\n' // TODO: Allow setting this at the service level and at the method level.

    // General port info:
    manufacturer?: string
    serialNumber?: string
    pnpId?: string
    locationId?: string
    productId?: string
    vendorId?: string

    constructor(public path: string) { }

    toString() {
        return `ComPort(path=${this.path}, state=${this.state}${this.type ? ', type=' : ''}${this.type ? this.type?.name : ''}${this.lastError ? ', lastError=' : ''}${this.lastError ? this.lastError : ''})`;
    }

    async setType(type: ComType): Promise<boolean> {
        try {
            await this.connect(type.baud); // throws an error if connection fails
            await sleep(type.startupDelay); // wait for device to startup if needed
            await this.send(type.macros.init);
            if (this.readComplete) {
                this.type = type;
                return true;
            } else {
                return false;
            }
        } finally {
            await this.close();
        }
    }

    /**
     * Opens the serial port with either the given baud rate or the baud rate
     * set in the ComPort's type. Once successfully open the port will be in
     * the background state and may be used to write and read.
     * @param baud The Baud rate.
     * @returns A Promise.
     */
    async connect(baud?: number): Promise<void> {
        if (!baud && !this.type) {
            throw new Error('No baud rate set while trying to connect. Either pass the baud rate to the connect function or set a ComType first.');
        }
        if (!baud) {
            baud = this.type!.baud;
        }
        this.state = 'connecting';

        this.port = new SerialPort({
            path: this.path,
            baudRate: baud,
            autoOpen: false
        });

        this.port.on('error', this.receiveError.bind(this));
        this.port.on('data', this.receiveData.bind(this));

        return new Promise<void>((resolve, reject) => {
            this.port!.open((err: Error | null) => {
                if (err) {
                    this.state = 'closed';
                    this.lastError = err.message;
                    reject(err);
                    return;
                }
                // this.resetResponse()
                // Successfully opened:
                console.log(`Connected to com port ${this.path}.`);
                this.state = 'background';
                resolve();
            });
        });
    }

    /**
     * Read from the serial port until either the given pattern is
     * matched in the read data or the ComPort's timeout is reached.
     * @param match The RegExp to match against read data.
     * @returns The read data.
     */
    async read(match: RegExp): Promise<string> {
        let time = Date.now()
        this.readMatch = match
        this.buffer = ''
        this.lastError = null
        this.readComplete = false

        return new Promise<string>((resolve, reject) => {
            const checkCompletion = () => {
                if (this.readComplete) {
                    resolve(this.buffer.trim())
                } else if (Date.now() - time > this.timeout) {
                    reject(new Error(`Timeout after ${this.timeout}ms while reading from port ${this.path}.`)) // TODO: Create custom timeout error class.
                } else if (this.lastError) {
                    reject(new Error(this.lastError))
                } else {
                    setTimeout(() => {
                        checkCompletion()
                    }, 100);
                }
            };
            checkCompletion()
        })
    }

    /**
     * Writes the given command string to the serial port.
     * @param command The command to write.
     * @returns A Promise.
     */
    async write(command: string): Promise<void> {
        if (!this.port || !this.port.isOpen) {
            throw new Error('Port not open. Please open the port via the connect function before attempting to write.');
        }

        // Asynchronously write data to the port:
        return new Promise((resolve, reject) => {
            this.port!.write(command + this.lineEnding, (err) => {
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
        return new Promise<void>((resolve, reject) => {
            this.port?.close((err) => {
                if (!this.port!.isOpen) {
                    this.port = null;
                    this.state = 'closed';
                }
                if (err) {
                    reject(err);
                } else {
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
    async lockPort(): Promise<void> {
        // Already available:
        if (this.state === 'background') {
            this.state = 'busy'
            return;
        }

        // If port is not connected then connect:
        if (this.state === 'closed') {
            console.log(`Port ${this.path} is closed - connecting...`);
            await this.connect();
        }

        // If currently connecting, first wait until connected:
        let attempt = 0;
        while (this.state === 'connecting' && attempt < 10) {
            await new Promise<void>(resolve => setTimeout(() => resolve(), 100));
            attempt++;
        }
        if (this.state === 'connecting') {
            throw new Error(`Timeout while waiting for connection to complete.`);
        }
        console.log(`Port ${this.path} connected.`);

        // If busy, wait until available:
        const MAX_ATTEMPTS = 10;
        attempt = 0;
        while (this.state === 'busy' && attempt < MAX_ATTEMPTS) {
            console.log(`Port ${this.path} is busy - waiting...`);
            await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
            attempt++;
        }
        if (this.state === 'busy') {
            throw new Error(`Timeout while waiting for port to become available.`);
        }

        this.state = 'busy'
        console.log(`Port ${this.path} is now available.`);
    }

    /**
     * Executes the macros for the given method while the responses are matched.
     * After execution the com port's state will be 'background'.
     * @param operationId The operationId name to execute.
     * @param params The parameters to replace in the macro commands.
     * @return An array of the responses from each command.
     */
    async send(operationId: string, params?: { [name: string]: any; }): Promise<string[]>;

    /**
     * Executes the given macros while the responses are matched.
     * After execution the com port's state will be 'background'.
     * @param macros The array of macros to execute.
     * @param params The parameters to replace in the macro commands.
     * @return An array of the responses from each command.
     */
    async send(macros: ComMacro[], params?: { [name: string]: any; }): Promise<string[]>;

    async send(macros_operationId: ComMacro[] | string, params?: { [name: string]: any; }): Promise<string[]> {

        if (typeof macros_operationId === 'string') {
            if (!this.type) {
                throw new Error(`Cannot send to com port ${this.path} by operationId without a type.`);
            }
            console.log(`Sending macros for operationId '${macros_operationId}' on port ${this.path}.`);
            return this.send(this.type.macros[macros_operationId], params);
        }

        if (!macros_operationId || macros_operationId.length === 0) {
            throw new Error(`No macros provided to send to com port ${this.path}.`);
        }

        let macros = macros_operationId as ComMacro[];

        // Replace parameters in each macro command:
        if (params) {
            macros = macros.map(m => {
                let command = m.command;

                // Extract all parameters in the command.
                // These have the form {param}:
                const paramRegex = /{([^}]+)}/gm;
                let match;
                const commandParams: string[] = [];
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
                                val = val[key as any];
                            }

                            // Check if the property has an array index:
                            else if (key.endsWith(']') && key.includes('[')) {
                                const arrKey = key.substring(0, key.indexOf('[')) as any;
                                const indexStr = key.substring(key.indexOf('[') + 1, key.length - 1);
                                const index = parseInt(indexStr);
                                if (val && val.hasOwnProperty(arrKey) && Array.isArray(val[arrKey]) && val[arrKey].length > index) {
                                    val = val[arrKey][index];
                                }
                            }
                            // else not found.
                        }
                    } else {
                        val = params[p];
                    }

                    command = command.replaceAll(re, val);
                });

                return new ComMacro(command, m.response);
            });
        }

        // Execute each macro in turn:
        const responses = [];
        for (let macro of macros) {
            // Wait for port the become available:
            await this.lockPort()

            // Write the command and wait for the response:
            await this.write(macro.command);
            const response = await this.read(macro.response);
            responses.push(response);
        }

        return responses;
    }

    receiveError(err: Error) {
        console.error(`Error on port ${this.path}: ${err.message}`);
        this.lastError = err.message;

        if (this.port?.isOpen) {
            // If the error did not close the port, then return to background processing:
            this.state = 'background';
        } else {
            // If the error closed the port, then set state to closed
            // and remove the SerialPort if needed:
            this.state = 'closed';
            if (this.port) {
                this.close();
            }
        }
    }

    receiveData(data: Buffer) {
        // Background Log:
        if (this.state === 'background') {
            const dataStr = data.toString();
            const lines = dataStr.split(/\r?\n/);

            if (lines.length > 0) {
                // Append to the last entry to ensure incompelte lines are joined:
                if (this.backgroundBuffer.length > 0) {
                    this.backgroundBuffer[this.backgroundBuffer.length - 1] += lines[0];
                } else {
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
                this.lastError = 'State was busy reading data but no read RegExp was found to check for completion.'
                this.state = 'background'
                return
            }
            this.buffer += data.toString()
            if (this.readMatch.test(this.buffer.toString().trim())) {
                this.state = 'background'
                this.readComplete = true
            }
        }
        else {
            console.error(`Port ${this.path} received data in unexpected state '${this.state}': ${data.toString()}`);
        }
    }
}

async function sleep(startupDelay: number) {
    return new Promise<void>(resolve => setTimeout(() => resolve(), startupDelay));
}

