// Jest setup file to configure mocks
import { EventEmitter } from 'events';

// Create the mock SerialPort class
export class MockSerialPort extends EventEmitter {
  private _isOpen: boolean = false;
  public path: string;
  public baudRate: number;

  static mockPortsList: any[] = [];
  static mockWriteResponse: Error | null = null;
  static mockOpenResponse: Error | null = null;
  static mockCloseResponse: Error | null = null;

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
      if (MockSerialPort.mockOpenResponse) {
        callback(MockSerialPort.mockOpenResponse);
        MockSerialPort.mockOpenResponse = null;
      } else {
        this._isOpen = true;
        callback(null);
      }
    }, 0);
  }

  write(data: string, callback?: (err: Error | null) => void): void {
    setTimeout(() => {
      if (callback) {
        callback(MockSerialPort.mockWriteResponse);
        MockSerialPort.mockWriteResponse = null;
      }
    }, 0);
  }

  close(callback?: (err: Error | null) => void): void {
    setTimeout(() => {
      this._isOpen = false;
      if (callback) {
        callback(MockSerialPort.mockCloseResponse);
        MockSerialPort.mockCloseResponse = null;
      }
    }, 0);
  }

  simulateData(data: string | Buffer): void {
    this.emit('data', Buffer.from(data));
  }

  simulateError(error: Error): void {
    this.emit('error', error);
  }

  static async list(): Promise<any[]> {
    return Promise.resolve(MockSerialPort.mockPortsList);
  }

  static resetMocks(): void {
    MockSerialPort.mockPortsList = [];
    MockSerialPort.mockWriteResponse = null;
    MockSerialPort.mockOpenResponse = null;
    MockSerialPort.mockCloseResponse = null;
  }

  static setMockPorts(ports: any[]): void {
    MockSerialPort.mockPortsList = ports;
  }

  static setMockWriteError(error: Error | null): void {
    MockSerialPort.mockWriteResponse = error;
  }

  static setMockOpenError(error: Error | null): void {
    MockSerialPort.mockOpenResponse = error;
  }

  static setMockCloseError(error: Error | null): void {
    MockSerialPort.mockCloseResponse = error;
  }
}

export type MockedSerialPortStatic = typeof MockSerialPort;
