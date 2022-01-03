
export class LocaleCode {
	public constructor(
		public readonly language: string,
		public readonly suffix: string[],
	) {}

	public toString(sep = "-"): string {
		return `${this.language}${sep}${this.suffix.join(sep)}`;
	}

	public static parse(code: string): LocaleCode {
		const parts = code.split(/[^a-z]/ig);
		return new LocaleCode(parts[0], parts.slice(1));
	}
}
