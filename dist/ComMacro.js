"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComMacro = void 0;
class ComMacro {
    constructor(command, response) {
        this.command = command;
        this.response = response;
    }
    toString() {
        return `ComMacro(command='${this.command}', response=${this.response.toString()})`;
    }
}
exports.ComMacro = ComMacro;
//# sourceMappingURL=ComMacro.js.map