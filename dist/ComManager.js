"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComManager = void 0;
exports.enableDebug = enableDebug;
const serialport_1 = require("serialport");
const ComPort_1 = require("./ComPort");
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
 * Maintains a list of ports and types, and handles scanning for new ports and matching them to types.
 */
class ComManager {
    constructor() {
        this.ports = [];
        this.types = [];
        this.refreshInterval = 60000; // 60 seconds
        this.defaultTimeout = undefined; // assigned to ports on creation
        this.refreshIntervalHandle = null;
    }
    async init(types = []) {
        this.types = types;
        try {
            await this.scanPorts();
            debug("ComManager initialized.");
        }
        catch (err) {
            console.error("Error initializing ComManager: ", err);
            setTimeout(() => this.init(), 1000); // retry
        }
        this.scheduleRefresh();
    }
    scheduleRefresh() {
        // Clear any current job:
        if (this.refreshIntervalHandle) {
            clearInterval(this.refreshIntervalHandle);
        }
        // A negative interval disables refreshing:
        if (this.refreshInterval < 0) {
            debug('ComManager auto-refresh disabled.');
            return;
        }
        // Schedule a new job:
        this.refreshIntervalHandle = setTimeout(async () => {
            debug('Rescanning com ports...');
            try {
                this.scanPorts();
            }
            catch (err) {
                console.error("Error scanning ports: ", err);
            }
            finally {
                this.scheduleRefresh(); // reschedule the next refresh
            }
        }, this.refreshInterval);
    }
    getComPort(typeName, index_name) {
        const typePorts = this.ports.filter(p => p.type?.name === typeName);
        if (typeof index_name === 'string') {
            const port = typePorts.find(p => p.name === index_name);
            if (!port) {
                throw new Error(`Port with name ${index_name} not found for type ${typeName}.`);
            }
            return port;
        }
        const index = index_name;
        // Make sure the port exists and has a known type:
        if (index >= typePorts.length) {
            throw new Error(`Port with index ${index} not found. ${typePorts.length} ports found of type ${typeName}.`); // TODO: Create custom not found error class.
        }
        return typePorts[index];
    }
    async scanPorts() {
        debug(`Scanning serial ports...`);
        try {
            const ports = await serialport_1.SerialPort.list();
            await Promise.all(ports.map(async (p) => {
                // Send hello message to existing ports:
                const existingPort = this.ports.find(existing => existing.path === p.path);
                if (existingPort && existingPort.type) {
                    try {
                        debug(`Sending hello message to port ${existingPort.path} of type ${existingPort.type?.name}...`);
                        await existingPort.send('init');
                        debug(`Response received from port ${existingPort.path}.`);
                    }
                    catch (err) {
                        debug(`Port ${existingPort.path} of type ${existingPort.type?.name} is not responding.`);
                        // Close the port if open:
                        if (existingPort.state !== 'closed') {
                            await existingPort.close();
                        }
                    }
                    return;
                }
                // Remove existing ports of unknown type so that we can try again:
                if (existingPort && !existingPort.type) {
                    debug(`Removing existing port ${existingPort.path} of unknown type for re-detection.`);
                    this.ports = this.ports.filter(p => p.path !== existingPort.path);
                }
                // Add new port:
                const port = new ComPort_1.ComPort(p.path);
                if (this.defaultTimeout) {
                    port.timeout = this.defaultTimeout;
                }
                port.path = p.path;
                port.manufacturer = p.manufacturer;
                port.serialNumber = p.serialNumber;
                port.pnpId = p.pnpId;
                port.locationId = p.locationId;
                port.productId = p.productId;
                port.vendorId = p.vendorId;
                this.ports.push(port);
                // Check if the port supports one of the known com types:
                for (let type of this.types) {
                    try {
                        // Try to set the type:
                        if (!await port.setType(type)) {
                            continue;
                        }
                        // If the type was set without error, then the port
                        // supports this type:
                        debug(`Com port of type ${type.name} found at path ${port.path}`);
                        // Open the port for background use:
                        await port.connect();
                        break;
                    }
                    catch (err) {
                        debug(`Failed to add type to port: ${port.toString()}`);
                        console.error(err);
                        continue;
                    }
                }
            }));
            debug(`Com ports: \n\t${this.ports.map(p => p.toString()).join(',\n\t')}`);
        }
        catch (error) {
            console.error(`Error scanning serial ports: ${error.message}`);
        }
    }
    async list(type, operationId, params) {
        const results = [];
        const ports = this.ports.filter(p => p.type?.name === type);
        for (let index = 0; index < ports.length; index++) {
            results.push(await this.send(type, index, operationId, params));
        }
        return results;
    }
    async send(type, index_name, operationId, params) {
        const port = this.getComPort(type, index_name);
        const responses = await port.send(operationId, params);
        return responses;
    }
}
exports.ComManager = ComManager;
//# sourceMappingURL=ComManager.js.map