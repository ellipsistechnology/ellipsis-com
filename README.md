# ellipsis-com

Serial communication management with command/response macros defined by regular expressions. The library wraps a serial port, executes macros, and exposes a manager for discovering and interacting with devices.

## Features
- Connect to serial ports with a configured baud rate
- Send command macros and wait for regex-matched responses
- Manage multiple devices via a central manager

## Install

```bash
npm install
```

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

## Basic usage

```ts
import { ComManager } from '../ComManager'
import { ComMacro } from '../ComMacro'

/**
 * This demo works with the arduino-demo sketch.
 */
async function demo() {
    const manager = new ComManager()

    // Initialise the manager with a com type that has some macros.
    // The init macro is required and is used to identify the type of a port when it is connected. 
    // The other macros are optional and can be used to define commands that can be sent to the device.
    await manager.init(
        [{
            name: 'myType',
            baud: 9600,
            startupDelay: 2000, // optional delay to wait for device to startup after connecting and before sending init
            macros: {
                // Command to initialise and identify type - must have key 'init':
                init: [new ComMacro('INFO', /MOCK\sDEVICE\sV\d+.?\d*[\n\r]+STATUS: OK[\n\r]+CMD DONE$/gm)], // regex to identify device as being of myType

                // Basic command and response pattern - can be named anything:
                getData: [new ComMacro('GET DATA', /CMD DONE$/gm)],

                // Command with parameters:
                setData: [new ComMacro('SET DATA {val}', /CMD DONE$/gm)],

                // Command with a sequence of commands and responses:
                deleteData: [
                    new ComMacro('DEL DATA', /Are you sure\? \(Y\/N\)$/gm),
                    new ComMacro('Y', /CMD DONE$/gm)
                ]
            }
        }]
    )

    // Send the getData command to the first port of type 'myType':
    let data = await manager.send('myType', 0, 'getData')
    console.log('\nGet data response - ', data[0], '\n') // data is an array of responses matching the regex for the macro

    // Send the setData command with a parameter:
    await manager.send('myType', 0, 'setData', {val: 'abc123'})
    data = await manager.send('myType', 0, 'getData')
    console.log('\nData changed - ', data[0], '\n')

    // Delete the data using the deleteData command which has a sequence of commands and responses:
    await manager.send('myType', 0, 'deleteData')
    data = await manager.send('myType', 0, 'getData')
    console.log('\nAfter deletion - ', data[0], '\n')
}

demo()
```

## Project structure
- src/ComPort.ts: serial port wrapper with read/write/macro support
- src/ComType.ts: device type definition and macro configuration
- src/ComMacro.ts: command/response macro definition
- src/ComManager.ts: device discovery and access by type

## License
ISC
