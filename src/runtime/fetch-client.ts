import { LocaleData, U27N } from ".";
import { Locale } from "./locale.js";

export class FetchClient implements U27N.Client {
	readonly #url: string;
	readonly #cache: Set<string> | null;

	public constructor(options: string | FetchClient.Options) {
		if (typeof options === "string") {
			options = {
				url: options,
			};
		}
		this.#url = options.url ?? "/locale/[locale].json";
		this.#cache = (options.cache ?? true) ? new Set() : null;
	}

	public async fetchResources(_controller: U27N, locale: Locale): Promise<void> {
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

	public clearCache(): void {
		this.#cache?.clear();
	}
}

export namespace FetchClient {
	export class RequestError extends Error {
		public constructor(public readonly response: Response) {
			super(`${response.status} ${response.statusText}`);
		}
	}

	export interface Options {
		url?: string;
		cache?: boolean;
	}
}
