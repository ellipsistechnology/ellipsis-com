import { ComMacro } from './ComMacro';
import { ComType } from './ComType';
export declare function enableDebug(enable?: boolean): void;
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
export declare class ComPort {
    path: string;
    private port;
    private readMatch?;
    private readComplete;
    private buffer;
    backgroundBuffer: string[];
    name: string | null;
    state: 'busy' | 'closed' | 'background' | 'connecting';
    type: ComType | null;
    lastError: string | null;
    timeout: number;
    lineEnding: string;
    manufacturer?: string;
    serialNumber?: string;
    pnpId?: string;
    locationId?: string;
    productId?: string;
    vendorId?: string;
    constructor(path: string);
    toString(): string;
    setType(type: ComType): Promise<boolean>;
    /**
     * Opens the serial port with either the given baud rate or the baud rate
     * set in the ComPort's type. Once successfully open the port will be in
     * the background state and may be used to write and read.
     * @param baud The Baud rate.
     * @returns A Promise.
     */
    connect(baud?: number): Promise<void>;
    /**
     * Read from the serial port until either the given pattern is
     * matched in the read data or the ComPort's timeout is reached.
     * @param match The RegExp to match against read data.
     * @returns The read data.
     */
    read(match: RegExp): Promise<string>;
    /**
     * Writes the given command string to the serial port.
     * @param command The command to write.
     * @returns A Promise.
     */
    write(command: string): Promise<void>;
    /**
     * Closes the port. If successfully closed, the port's state will
     * be closed.
     * @returns A Promise.
     */
    close(): Promise<void>;
    /**
     * Attempts to set the port state to busy.
     * If the port is currently closed, it will attempt to connect.
     * If the port is currently connecting, it will wait until the connection is complete.
     * If the port is currently busy, it will wait until the port becomes available.
     * If the port does not become available within a certain time frame, an error will be thrown.
     * @returns
     */
    lockPort(): Promise<void>;
    /**
     * Executes the macros for the given method while the responses are matched.
     * After execution the com port's state will be 'background'.
     * @param operationId The operationId name to execute.
     * @param params The parameters to replace in the macro commands.
     * @return An array of the responses from each command.
     */
    send(operationId: string, params?: {
        [name: string]: any;
    }): Promise<string[]>;
    /**
     * Executes the given macros while the responses are matched.
     * After execution the com port's state will be 'background'.
     * @param macros The array of macros to execute.
     * @param params The parameters to replace in the macro commands.
     * @return An array of the responses from each command.
     */
    send(macros: ComMacro[], params?: {
        [name: string]: any;
    }): Promise<string[]>;
    receiveError(err: Error): void;
    receiveData(data: Buffer): void;
}
//# sourceMappingURL=ComPort.d.ts.map