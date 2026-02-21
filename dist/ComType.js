"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComType = void 0;
class ComType {
    constructor(name, baud, macros, startupDelay) {
        this.name = name;
        this.baud = baud;
        this.macros = macros;
        this.startupDelay = 0;
        if (startupDelay) {
            this.startupDelay = startupDelay;
        }
    }
    toString() {
        return `ComType(name='${this.name}', baud=${this.baud})`
            + `[${Object.entries(this.macros).map(([m, macros]) => (`\n\t${m}: [${macros.map(cm => cm.toString()).join(', ')}]`)).join('')}\n]`;
    }
}
exports.ComType = ComType;
//# sourceMappingURL=ComType.js.map