import { ComManager } from '../ComManager'
import { SerialPort } from 'serialport'
import { ComPort } from '../ComPort'
import { ComMacro } from '../ComMacro'
import { ComType } from '../ComType'

const MOCK_PORTS = [
  {
    path: '/dev/mock1',
    manufacturer: 'ellipsis',
    serialNumber: '123456',
    pnpId: 'pnpId123',
    locationId: 'location123',
    vendorId: 'EL001',
    productId: 'MOCK001'
  },
  {
    path: '/dev/mock2',
    manufacturer: 'ellipsis',
    serialNumber: '123457',
    pnpId: 'pnpId123',
    locationId: 'location123',
    vendorId: 'EL001',
    productId: 'MOCK001'
  },
  {
    path: '/dev/tty.Bluetooth-Incoming-Port',
    manufacturer: undefined,
    serialNumber: undefined,
    pnpId: undefined,
    locationId: undefined,
    vendorId: undefined,
    productId: undefined
  }
]

const mockType: ComType = new ComType(
    'mock',
    9600,
    {
        init: [new ComMacro('init', /INITTED/)],
        help: [new ComMacro('help', /SOME INSTRUCTIONS/)]
    }
)

const sleep = (ms: number) => {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('ComManager', () => {
    let comManager: ComManager

    beforeEach(() => {
        jest.clearAllMocks();
        (SerialPort as any).resetMocks();
        (SerialPort as any).setMockPorts(MOCK_PORTS)
        comManager = new ComManager()
        comManager.refreshInterval = -1
        comManager.defaultTimeout = 10
    })

    afterEach(() => {
        (SerialPort as any).resetMocks()
    })

    describe('scanPorts', () => {
        it('should find available ports', async () => {
            await comManager.scanPorts()
            expect(comManager.ports.length).toBe(MOCK_PORTS.length)
            expect(comManager.ports[0].path).toBe(MOCK_PORTS[0].path)
            expect(comManager.ports[1].path).toBe(MOCK_PORTS[1].path)
            expect(comManager.ports[2].path).toBe(MOCK_PORTS[2].path)
        })

        it('should associate types to ports', async () => {
            comManager.types = [mockType]
            await comManager.scanPorts();

            // Simulate the first port responding to the init macro and the others not responding:
            (SerialPort as any).setNextResponse('INITTED')

            await comManager.scanPorts()

            // First should have the type set:
            expect(comManager.ports[0].type).toBe(mockType)
            expect(comManager.ports[1].type).toBeNull()
            expect(comManager.ports[2].type).toBeNull()

            // Only first has a type and so others should be closed:
            expect(comManager.ports[0].state).toBe('background')
            expect(comManager.ports[1].state).toBe('closed')
            expect(comManager.ports[2].state).toBe('closed')
        })

        it('should successfully scan ports on init', async () => {
            // Simulate the first port responding to the init macro and the others not responding:
            (SerialPort as any).setNextResponse('INITTED')
            await comManager.init([mockType])
            
            // First should have the type set:
            expect(comManager.ports[0].type).toBe(mockType)
            expect(comManager.ports[1].type).toBeNull()
            expect(comManager.ports[2].type).toBeNull()

            // Only first has a type and so others should be closed:
            expect(comManager.ports[0].state).toBe('background')
            expect(comManager.ports[1].state).toBe('closed')
            expect(comManager.ports[2].state).toBe('closed')
        })
    })

    describe('get port', () => {
        it('should return the correct port by type and index', async () => {
            // Simulate the first port responding to the init macro and the others not responding:
            (SerialPort as any).setNextResponse('INITTED')
            await comManager.init([mockType])

            const port = comManager.getComPort('mock', 0)
            expect(port).toBe(comManager.ports[0])
        })

        it('should throw an error if port not found by index', async () => {
            // Simulate the first port responding to the init macro and the others not responding:
            (SerialPort as any).setNextResponse('INITTED')
            await comManager.init([mockType])

            expect(() => comManager.getComPort('mock', 99)).toThrow()
        })

        it('should return the correct port by type and name', async () => {
            // Simulate the first port responding to the init macro and the others not responding:
            (SerialPort as any).setNextResponse('INITTED')
            await comManager.init([mockType])
            comManager.ports[0].name = '123456' // set name to serial number for testing

            const port = comManager.getComPort('mock', '123456')
            expect(port).toBe(comManager.ports[0])
        })

        it('should throw an error if port not found by name', async () => {
            // Simulate the first port responding to the init macro and the others not responding:
            (SerialPort as any).setNextResponse('INITTED')
            await comManager.init([mockType])
            comManager.ports[0].name = '123456' // set name to serial number for testing

            expect(() => comManager.getComPort('mock', 'nonexistent')).toThrow()
        })
    })

    describe('send', () => {
        it('should send messages to the correct port by index', async () => {
            (SerialPort as any).setNextResponse('INITTED')
            await comManager.init([mockType])

            const sendPromise = comManager.send('mock', 0, 'help');
            (SerialPort as any).setNextResponse('SOME INSTRUCTIONS') // simulate response from device
            await Promise.resolve(sendPromise) // wait for send to complete
        })

        it('should send messages to the correct port by name', async () => {
            (SerialPort as any).setNextResponse('INITTED')
            await comManager.init([mockType])
            comManager.ports[0].name = '123456' // set name to serial number for testing

            const sendPromise = comManager.send('mock', '123456', 'help');
            (SerialPort as any).setNextResponse('SOME INSTRUCTIONS') // simulate response from device
            await Promise.resolve(sendPromise) // wait for send to complete
        })
    })

    describe('refresh interval', () => {
        it('should refresh the port list at the specified interval', async () => {
            (SerialPort as any).setNextResponse('INITTED')
            comManager.refreshInterval = 500
            await comManager.init([mockType])
            expect(comManager.ports[0].type).toBe(mockType)

            // Check that the port was correctly initialized:
            const mockPort = comManager.getComPort('mock', 0)
            expect(mockPort).toBeDefined()
            expect(mockPort.type).toBe(mockType);

            const sendSpy = jest.spyOn(mockPort, 'send');

            // Make sure the port will be refreshed by receiving a response to the hello message:
            (SerialPort as any).setNextResponse('INITTED')

            // Wait for refresh to happen - port init should have been sent and port should be open:
            await sleep(comManager.refreshInterval + 200) // add a buffer to make sure the refresh has completed
            expect(sendSpy).toHaveBeenCalledWith('init')
            expect(mockPort.state).toBe('background')
            sendSpy.mockClear()

            // Wait for next refresh to happen which will not receive a response and should close the port:
            await sleep(comManager.refreshInterval)
            expect(mockPort.state).toBe('closed')

            // Cancel autorefresh:
            comManager.refreshInterval = -1
            clearInterval((comManager as any).refreshIntervalHandle) // ensure rescans don't run after the test finishes
        })
    })
})
            