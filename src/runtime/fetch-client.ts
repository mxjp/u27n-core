import { U27N } from "./controller.js";
import { Locale } from "./locale.js";
import { LocaleData } from "./locale-data.js";

export class FetchClient implements U27N.Client {
	readonly #url: string;
	readonly #cache: Set<string> | null;

	constructor(options: string | FetchClient.Options) {
		if (typeof options === "string") {
			options = {
				url: options,
			};
		}
		this.#url = options.url ?? "/locale/[locale].json";
		this.#cache = (options.cache ?? true) ? new Set() : null;
	}

	async fetchResources(_controller: U27N, locale: Locale): Promise<void> {
		const url = this.#url.replace(/\[locale\]/g, locale.code);

		if (this.#cache?.has(url)) {
			return;
		}
		this.#cache?.add(url);

		const response = await fetch(url);
		if (response.ok) {
			locale.addData(await response.json() as LocaleData);
		} else {
			throw new FetchClient.RequestError(response);
		}
	}

	clearCache(): void {
		this.#cache?.clear();
	}
}

export namespace FetchClient {
	export class RequestError extends Error {
		constructor(readonly response: Response) {
			super(`${response.status} ${response.statusText}`);
		}
	}

	export interface Options {
		url?: string;
		cache?: boolean;
	}
}
