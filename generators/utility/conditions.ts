
export class Conditions {
	public constructor(
		public readonly symbol: "&&" | "||",
		public readonly operands: (string | Conditions)[] = [],
	) {}

	public toString(): string {
		return this.operands
			.filter(operand => {
				return typeof operand === "string"
					? operand.length > 0
					: !operand.isEmpty;
			})
			.map(operand => {
				return typeof operand === "string"
					? operand
					: ((operand.isGroup && this.operands.length > 1) ? `(${operand.toString()})` : operand.toString());
			})
			.join(` ${this.symbol} `);
	}

	public get isEmpty(): boolean {
		return this.operands.length === 0
			|| this.operands.every(operand => {
				return typeof operand === "string"
					? operand.length === 0
					: operand.isEmpty;
			});
	}

	public get isGroup(): boolean {
		if (this.operands.length > 1) {
			return true;
		}
		const operand = this.operands[0];
		return operand instanceof Conditions && operand.isGroup;
	}
}
