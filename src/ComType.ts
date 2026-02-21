import { ComMacro } from './ComMacro';


export class ComType {
    startupDelay: number = 0

    constructor(
        public name: string,
        public baud: number,
        public macros: {
            init: ComMacro[];
            [operationId: string]: ComMacro[];
        },
        startupDelay?: number
    ) {
        if(startupDelay) {
            this.startupDelay = startupDelay
        }
    }

    toString() {
        return `ComType(name='${this.name}', baud=${this.baud})`
            + `[${Object.entries(this.macros).map(([m, macros]) => (
                `\n\t${m}: [${macros.map(cm => cm.toString()).join(', ')}]`
            )).join('')}\n]`;
    }
}
