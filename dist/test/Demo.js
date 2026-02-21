"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ComManager_1 = require("../ComManager");
const ComMacro_1 = require("../ComMacro");
/**
 * This demo works with the arduino-demo sketch.
 */
async function demo() {
    const manager = new ComManager_1.ComManager();
    // Initialise the manager with a com type that has some macros.
    // The init macro is required and is used to identify the type of a port when it is connected. 
    // The other macros are optional and can be used to define commands that can be sent to the device.
    await manager.init([{
            name: 'myType',
            baud: 9600,
            startupDelay: 2000, // optional delay to wait for device to startup after connecting and before sending init
            macros: {
                // Command to initialise and identify type - must have key 'init':
                init: [new ComMacro_1.ComMacro('INFO', /MOCK\sDEVICE\sV\d+.?\d*[\n\r]+STATUS: OK[\n\r]+CMD DONE$/gm)], // regex to identify device as being of myType
                // Basic command and response pattern - can be named anything:
                getData: [new ComMacro_1.ComMacro('GET DATA', /CMD DONE$/gm)],
                // Command with parameters:
                setData: [new ComMacro_1.ComMacro('SET DATA {val}', /CMD DONE$/gm)],
                // Command with a sequence of commands and responses:
                deleteData: [
                    new ComMacro_1.ComMacro('DEL DATA', /Are you sure\? \(Y\/N\)$/gm),
                    new ComMacro_1.ComMacro('Y', /CMD DONE$/gm)
                ]
            }
        }]);
    // Send the getData command to the first port of type 'myType':
    let data = await manager.send('myType', 0, 'getData');
    console.log('\nGet data response - ', data[0], '\n'); // data is an array of responses matching the regex for the macro
    // Send the setData command with a parameter:
    await manager.send('myType', 0, 'setData', { val: 'abc123' });
    data = await manager.send('myType', 0, 'getData');
    console.log('\nData changed - ', data[0], '\n');
    // Delete the data using the deleteData command which has a sequence of commands and responses:
    await manager.send('myType', 0, 'deleteData');
    data = await manager.send('myType', 0, 'getData');
    console.log('\nAfter deletion - ', data[0], '\n');
}
demo();
//# sourceMappingURL=Demo.js.map