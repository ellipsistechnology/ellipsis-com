import { ComMacro } from "../ComMacro"
import { ComPort } from "../ComPort"
import { SerialPort } from "serialport"
import { ComType } from "../ComType"

const sleep = (ms: number) => {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('ComPort', () => {
    let comPort: ComPort

    beforeEach(() => {
        jest.clearAllMocks();
        (SerialPort as any).resetMocks()
        comPort = new ComPort('/dev/serialportMock')
    })

    afterEach(() => {
        (SerialPort as any).resetMocks()
    })

    describe('connect', () => {
        it('should open the port successfully', async () => {
            const connectPromise = comPort.connect(9600)
            expect(comPort.state).toBe('connecting')
            await Promise.resolve(connectPromise) // wait for the open callback to be called
            expect(comPort.state).toBe('background')
        })

        it('should handle open errors', async () => {
            (SerialPort as any).setMockOpenError(new Error('Failed to open port'))
            const connectPromise = comPort.connect(9600)
            await expect(connectPromise).rejects.toThrow('Failed to open port')
            expect(comPort.state).toBe('closed')
            expect(comPort.lastError).toBe('Failed to open port')
        })

        it('should handle errors after opening', async () => {
            await comPort.connect(9600);
            (comPort as any).port.simulateError(new Error('Port error'))
            expect(comPort.state).toBe('background')
            expect(comPort.lastError).toBe('Port error')
        })

        it('should open on setting type', async () => {
            const setTypePromise = comPort.setType(new ComType(
                'serialportMock',
                9600,
                {
                    init: [new ComMacro('init', /INITTED/)]
                }
            ))
            expect(comPort.state).toBe('connecting');
            (SerialPort as any).setNextResponse('INITTED') // simulate response from device
            await Promise.resolve(setTypePromise) // wait for setType to complete
            expect(comPort.state).toBe('closed') // should close after init macros run
        })
    })

    describe('background', () => {
        it('should receive background input', async () => {
            await comPort.connect(9600);
            (comPort as any).port.simulateData('Hello, World!')
            expect(comPort.backgroundBuffer).toContain('Hello, World!')
        })
    })

    describe('send', () => {
        it('should send data successfully via a macro and receive a response', async () => {
            await comPort.connect(9600);
            const responsePromise = comPort.send([new ComMacro('HELP', /SOME INSTRUCTIONS/)]);
            (SerialPort as any).setNextResponse('SOME INSTRUCTIONS') // simulate response from device
            await Promise.resolve(responsePromise) // wait for the write callback to be called
        })

        it('should throw a timeout error if response not received in time', async () => {
            comPort.timeout = 500; // set a short timeout for testing
            await comPort.connect(9600);
            const responsePromise = comPort.send([new ComMacro('HELP', /SOME INSTRUCTIONS/)]);
            await expect(responsePromise).rejects.toThrow('Timeout after 500ms while reading from port /dev/serialportMock.')
        })

        it('should send a macro base on the operationId', async () => {
            
            (SerialPort as any).setNextResponse('INITTED') // simulate response from device
            await comPort.setType(new ComType(
                'serialportMock',
                9600,
                {
                    init: [new ComMacro('INIT', /INITTED/)],
                    help: [new ComMacro('HELP', /SOME INSTRUCTIONS/)]
                }
            ))
            expect(comPort.type).toBeDefined();
            
            (SerialPort as any).setNextResponse('SOME INSTRUCTIONS') // simulate response from device
            await comPort.send('help') // send should auto-connect based on type
            expect(comPort.state).toBe('background') // should return to background after macro completes
        })
    })

    describe('close', () => {
        it('should close the port successfully', async () => {
            await comPort.connect(9600);
            expect(comPort.state).toBe('background')
            await comPort.close()
            expect(comPort.state).toBe('closed')
        })
    })

    describe('congestion handling', () => {
        it('should queue sends while busy and execute them sequentially', async () => {
            await comPort.connect(9600);
            expect(comPort.state).toBe('background')

            // 1. Send two macros in quick succession:
            const sendPromise1 = comPort.send([new ComMacro('CMD1', /RESP1/)])
            const sendPromise2 = comPort.send([new ComMacro('CMD2', /RESP2/)])
            // Note that state may be either busy or background depending on timing.
            
            // 2. After a brief delay the state should be 'busy':
            await sleep(50)
            expect(comPort.state).toBe('busy'); // first send should set state to busy

            // 3. Simulate response for first command:
            (comPort as any).port.simulateData('RESP1')
            await sendPromise1 // wait for first send to complete
            expect(comPort.state).toBe('background'); // should return to background after first macro completes

            // 4. After another brief delay, the state should again be busy as the second send starts processing:
            await sleep(500)
            expect(comPort.state).toBe('busy'); // second send should now be processing and waiting for response

            // 5. Simulate response for second command:
            (comPort as any).port.simulateData('RESP2')
            await sendPromise2 // wait for second send to complete
            expect(comPort.state).toBe('background') // should return to background after both macros complete
        })
    })
})