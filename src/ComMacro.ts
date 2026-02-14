
export class ComMacro {
    constructor(
        public command: string,
        public response: RegExp
    ) { }

    toString() {
        return `ComMacro(command='${this.command}', response=${this.response.toString()})`;
    }
}
