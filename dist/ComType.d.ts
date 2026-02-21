import { ComMacro } from './ComMacro';
export declare class ComType {
    name: string;
    baud: number;
    macros: {
        init: ComMacro[];
        [operationId: string]: ComMacro[];
    };
    startupDelay: number;
    constructor(name: string, baud: number, macros: {
        init: ComMacro[];
        [operationId: string]: ComMacro[];
    }, startupDelay?: number);
    toString(): string;
}
//# sourceMappingURL=ComType.d.ts.map