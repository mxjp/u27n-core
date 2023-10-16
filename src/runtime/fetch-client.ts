import { U27N } from "./controller.js";
import { Locale } from "./locale.js";
import { LocaleData } from "./locale-data.js";

/**
 * Uses {@link fetch} to load locale resources.
 */
export class FetchClient implements U27N.Client {
	readonly #url: string;
	readonly #cache: Set<string> | null;

	/**
	 * Create a new fetch client.
	 *
	 * @param options The {@link FetchClient.Options.url} value or an object with options.
	 */
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

	/**
	 * Manually clear the cache.
	 */
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
		/**
		 * The URL template to load resources from.
		 *
		 * The `[locale]` placeholder is replaced with the locale code.
		 *
		 * @default "/locale/[locale].json"
		 * @example
		 * ```js
		 * new FetchClient({
		 *   url: "/custom-path-[locale].json"
		 * })
		 * ```
		 */
		url?: string;

		/**
		 * Whether to cache the loaded resources.
		 *
		 * @default true
		 */
		cache?: boolean;
	}
}
