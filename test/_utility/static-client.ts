import { Locale, LocaleData, U27N } from "../../src/runtime/index.js";

export class StaticClient implements U27N.Client {
	#data: Map<string, LocaleData>;

	public constructor(data: [string, LocaleData][]) {
		this.#data = new Map(data);
	}

	public async fetchResources(controller: U27N, locale: Locale): Promise<void> {
		const data = this.#data.get(locale.code);
		if (data === undefined) {
			throw new Error("no data");
		}
		locale.addData(data);
	}
}
