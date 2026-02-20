import { EventEmitter } from 'events';

export class SerialPort extends EventEmitter {
  private _isOpen: boolean = false;
  public path: string;
  public baudRate: number;

  static mockPortsList: any[] = [];
  static mockWriteResponse: Error | null = null;
  static mockOpenResponse: Error | null = null;
  static mockCloseResponse: Error | null = null;
  static nextResponse: string | null = null;

  constructor(options: { path: string; baudRate: number; autoOpen?: boolean }) {
    super();
    this.path = options.path;
    this.baudRate = options.baudRate;

    if (options.autoOpen !== false) {
      setTimeout(() => this.open(() => {}), 0);
    }
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  open(callback: (err: Error | null) => void): void {
    
    setTimeout(() => {
      if (SerialPort.mockOpenResponse) {
        callback(SerialPort.mockOpenResponse)
        SerialPort.mockOpenResponse = null; // reset after use
      } else {
        this._isOpen = true;
        callback(null);
      }
    }, 0);
  }

  write(data: string, callback?: (err: Error | null) => void): void {
    setTimeout(() => {
      if (callback) {
        callback(SerialPort.mockWriteResponse)
        SerialPort.mockWriteResponse = null; // reset after use
      }

      if(SerialPort.nextResponse) {
        setTimeout(() => {
            if(SerialPort.nextResponse) {
                this.simulateData(SerialPort.nextResponse)
                SerialPort.nextResponse = null; // reset after use
            }
        }, 0);
      }
    }, 0);
  }

  close(callback?: (err: Error | null) => void): void {
    setTimeout(() => {
      this._isOpen = false;
      if (callback) {
        callback(SerialPort.mockCloseResponse)
        SerialPort.mockCloseResponse = null; // reset after use
      }
    }, 0);
  }

  // Method to simulate receiving data
  simulateData(data: string | Buffer): void {
    if(data === null) {
        throw new Error('Data cannot be null')
    }
    this.emit('data', Buffer.from(data));
  }

  // Method to simulate errors
  simulateError(error: Error): void {
    this.emit('error', error);
  }

  static async list(): Promise<any[]> {
    /**
        PortInfo {
            path: string;
            manufacturer: string | undefined;
            serialNumber: string | undefined;
            pnpId: string | undefined;
            locationId: string | undefined;
            productId: string | undefined;
            vendorId: string | undefined;
        }
     */
    return Promise.resolve(SerialPort.mockPortsList);
  }

  // Helper methods for tests
  static resetMocks(): void {
    SerialPort.mockPortsList = [];
    SerialPort.mockWriteResponse = null;
    SerialPort.mockOpenResponse = null;
  }

  static setMockPorts(ports: any[]): void {
    SerialPort.mockPortsList = ports;
  }

  static setMockWriteError(error: Error | null): void {
    SerialPort.mockWriteResponse = error;
  }

  static setMockOpenError(error: Error | null): void {
    SerialPort.mockOpenResponse = error;
  }

  static setNextResponse(data: string) {
    SerialPort.nextResponse = data;
  }
}
