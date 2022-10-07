
export class LocaleCode {
	constructor(
		readonly language: string,
		readonly suffix: string[],
	) {}

	toString(sep = "-"): string {
		return `${this.language}${sep}${this.suffix.join(sep)}`;
	}

	static parse(code: string): LocaleCode {
		const parts = code.split(/[^a-z]/ig);
		return new LocaleCode(parts[0], parts.slice(1));
	}
}
