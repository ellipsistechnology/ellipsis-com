import { ComType } from './ComType';
import { ComPort } from './ComPort';
export declare function enableDebug(enable?: boolean): void;
/**
 * Maintains a list of ports and types, and handles scanning for new ports and matching them to types.
 */
export declare class ComManager {
    ports: ComPort[];
    types: ComType[];
    refreshInterval: number;
    defaultTimeout: number | undefined;
    private refreshIntervalHandle;
    constructor();
    init(types?: ComType[]): Promise<void>;
    private scheduleRefresh;
    getComPort(typeName: string, index_name: number | string): ComPort;
    scanPorts(): Promise<void>;
    list(type: string, operationId: string, params: {
        [key: string]: any;
    }): Promise<string[][]>;
    send(type: string, index_name: number | string, operationId: string, params?: {
        [key: string]: any;
    }): Promise<string[]>;
}
//# sourceMappingURL=ComManager.d.ts.map