import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";

import { Manifest } from "./manifest.js";

/**
 * Utility for resolving and reading manifests using a cache.
 */
export class ManifestResolver {
	#resolving = new Map<string, Promise<ManifestResolver.Result | null>>();

	#resolve(context: string): Promise<ManifestResolver.Result | null> | null {
		let promise = this.#resolving.get(context);
		if (promise === undefined) {
			const filename = join(context, Manifest.NAME);
			promise = readFile(filename, "utf-8").then(json => {
				return {
					filename,
					context,
					manifest: Manifest.parse(json),
				};
			}, error => {
				if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
					throw error;
				}
				const parent = dirname(context);
				if (parent === context) {
					return null;
				}
				return this.#resolve(parent);
			});
			this.#resolving.set(context, promise);
		}
		return promise;
	}

	/**
	 * Resolve and read the manifest closest to the specified target filename.
	 *
	 * Note, that the resolved manifest may not include the specified target filename as output file.
	 */
	async resolve(targetFilename: string): Promise<ManifestResolver.Result | null> {
		if (!isAbsolute(targetFilename)) {
			throw new TypeError("filename must be an absolute path");
		}
		return this.#resolve(dirname(targetFilename));
	}
}

export declare namespace ManifestResolver {
	export interface Result {
		/** The absolute manifest filename. */
		filename: string;

		/**
		 * The absolute path of the directory, the manifest is located in.
		 */
		context: string;

		/**
		 * The parsed manifest.
		 */
		manifest: Manifest;
	}
}
