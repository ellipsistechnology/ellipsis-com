import { SerialPort } from 'serialport';
import type { MockedSerialPortStatic, MockedSerialPortInstance } from '../../__mocks__/serialport';

/**
 * Helper function to get the properly typed mocked SerialPort class
 */
export function getMockedSerialPort(): MockedSerialPortStatic {
  return SerialPort as unknown as MockedSerialPortStatic;
}

/**
 * Helper function to get a properly typed mocked SerialPort instance
 */
export function getMockedSerialPortInstance(instance: any): MockedSerialPortInstance {
  return instance as MockedSerialPortInstance;
}
