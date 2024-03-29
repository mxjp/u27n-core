import { mkdir, open, writeFile } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";

import { DataAdapter } from "../data-adapter.js";
import { DiscardObsoleteFragmentType } from "../obsolete-handling.js";
import { Source } from "../source.js";
import { DataJson } from "./json-format.js";

export class DefaultDataAdapter implements DataAdapter {
	#filename: string | undefined;
	#lastMtimeMs: number | undefined;

	#revision: number = 0;
	#modified = false;

	/** Map of source ids to sets of fragment ids */
	#sources = new Map<string, Set<string>>();
	/** Map of fragment ids to fragments */
	#fragments = new Map<string, DataAdapter.Fragment>();
	/** Array of discarded fragments */
	#obsolete: [string, DataAdapter.Fragment][] = [];

	watchPatterns?: string[] | undefined;

	/**
	 * Create a new default data adapter.
	 *
	 * @param filename The absolute filename where to store data. If undefined, this data adapter is inert and can only be used for testing by using {@link importJson} and {@link exportJson}.
	 * @param watchable If true, this adapter supports watching the translation data file for changes.
	 */
	constructor(filename?: string, watchable?: boolean) {
		if (filename !== undefined && !isAbsolute(filename)) {
			throw new TypeError("filename must be absolute");
		}
		this.#filename = filename;
		this.watchPatterns = watchable && filename !== undefined ? [filename] : undefined;
	}

	get revision(): number {
		return this.#revision;
	}

	/**
	 * Import translation data from it's json representation.
	 *
	 * This will increment the {@link revision}.
	 */
	importJson(data: DataJson): void {
		if (data.version !== 1) {
			throw new Error(`unsupported version: ${data.version}`);
		}
		function fragmentFromJson(fragment: DataJson.Fragment): DataAdapter.Fragment {
			return {
				value: fragment.value,
				modified: Date.parse(fragment.modified),
				sourceId: fragment.sourceId,
				enabled: fragment.enabled,
				translations: Object.fromEntries(
					Object
						.entries(fragment.translations)
						.map(([locale, translation]) => [locale, {
							value: translation.value,
							modified: Date.parse(translation.modified),
						}])
				),
			};
		}
		this.#sources = new Map();
		this.#fragments = new Map(
			Object
				.entries(data.fragments)
				.map(([id, f]) => [id, fragmentFromJson(f)])
		);
		this.#obsolete = data.obsolete.map(([id, f]) => [id, fragmentFromJson(f)]);
		this.#fragments.forEach((fragment, fragmentId) => {
			this.#addSourceFragmentPair(fragment.sourceId, fragmentId);
		});
		this.#revision++;
	}

	async reload(): Promise<boolean> {
		if (this.#filename === undefined) {
			throw new Error("data adapter is inert");
		}

		const file = await open(this.#filename).catch(error => {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
				throw error;
			}
		});

		if (file) {
			try {
				const stats = await file.stat();
				if (stats.mtimeMs !== this.#lastMtimeMs) {
					this.#lastMtimeMs = stats.mtimeMs;
					this.importJson(JSON.parse(await file.readFile("utf-8")) as DataJson);
					return true;
				}
			} finally {
				await file.close();
			}
		}

		this.importJson({
			version: 1,
			fragments: {},
			obsolete: [],
		});
		return false;
	}

	get modified(): boolean {
		return this.#modified;
	}

	/**
	 * Export translation data to it's json representation.
	 *
	 * This will not clear the {@link modified} flag. To clear it, use {@link clearModified}.
	 */
	exportJson(): DataJson {
		function byKey([a]: [string, unknown], [b]: [string, unknown]) {
			return a > b ? 1 : (a < b ? -1 : 0);
		}

		function fragmentToJson(fragment: DataAdapter.Fragment): DataJson.Fragment {
			return {
				value: fragment.value,
				modified: new Date(fragment.modified).toISOString(),
				sourceId: fragment.sourceId,
				enabled: fragment.enabled,
				translations: Object.fromEntries(
					Object
						.entries(fragment.translations)
						.sort(byKey)
						.map(([locale, translation]) => [locale, {
							value: translation.value,
							modified: new Date(translation.modified).toISOString(),
						}])
				),
			};
		}

		const sortedFragments = Array.from(this.#fragments);
		sortedFragments.sort(byKey);

		return {
			version: 1,
			fragments: Object.fromEntries(
				Array
					.from(this.#fragments)
					.sort(byKey)
					.map(([id, f]) => [id, fragmentToJson(f)])
			),
			obsolete: Array
				.from(this.#obsolete)
				.sort(byKey)
				.map(([id, f]) => [id, fragmentToJson(f)]),
		};
	}

	async persist(): Promise<void> {
		if (this.#filename === undefined) {
			throw new Error("data adapter is inert");
		}

		const json = this.exportJson();

		await mkdir(dirname(this.#filename), { recursive: true });
		await writeFile(this.#filename, JSON.stringify(json, null, "\t") + "\n", "utf-8");
		this.#modified = false;
	}

	/**
	 * Clear the {@link modified} flag.
	 */
	clearModified(): void {
		this.#modified = false;
	}

	updateFragment(sourceId: string, fragmentId: string, update: Source.FragmentUpdate): void {
		const existingFragment = this.#fragments.get(fragmentId);
		if (existingFragment !== undefined) {
			if (!DataAdapter.valueEquals(existingFragment.value, update.value)) {
				existingFragment.value = update.value ?? null;
				existingFragment.modified = Date.now();
				this.#modified = true;
			}
			if (existingFragment.enabled !== update.enabled) {
				existingFragment.enabled = update.enabled;
				this.#modified = true;
			}
			if (existingFragment.sourceId !== sourceId) {
				this.#removeSourceFragmentPair(existingFragment.sourceId, fragmentId);
				existingFragment.sourceId = sourceId;
				this.#addSourceFragmentPair(sourceId, fragmentId);
				this.#modified = true;
			}
		} else {
			const oldTranslations = update.oldFragmentId === undefined
				? undefined
				: this.#fragments.get(update.oldFragmentId)?.translations;

			this.#fragments.set(fragmentId, {
				sourceId,
				enabled: update.enabled,
				value: update.value ?? null,
				modified: Date.now(),
				translations: oldTranslations === undefined ? {} : structuredClone(oldTranslations),
			});
			this.#addSourceFragmentPair(sourceId, fragmentId);
			this.#modified = true;
		}
	}

	discardFragments(sourceId: string, type: DiscardObsoleteFragmentType, keepFragmentIds?: DataAdapter.IdSet): void {
		this.#sources.get(sourceId)?.forEach(fragmentId => {
			const fragment = this.#fragments.get(fragmentId)!;
			if (!keepFragmentIds?.has(fragmentId)) {
				this.#discardFragment(fragmentId, fragment, type);
			}
		});
	}

	discardSources(type: DiscardObsoleteFragmentType, keepSourceIds: DataAdapter.IdSet): void {
		this.#sources.forEach((fragmentIds, sourceId) => {
			if (!keepSourceIds.has(sourceId)) {
				fragmentIds.forEach(fragmentId => {
					this.#discardFragment(fragmentId, this.#fragments.get(fragmentId)!, type);
				});
			}
		});
	}

	getSyncFragment(sourceId: string, fragment: Source.Fragment): DataAdapter.Fragment | undefined {
		if (fragment.fragmentId === undefined) {
			return undefined;
		}
		if (fragment.value !== null) {
			const data = this.#fragments.get(fragment.fragmentId);
			if (data !== undefined
				&& data.sourceId === sourceId
				&& DataAdapter.valueEquals(fragment.value, data.value)
				&& fragment.enabled === data.enabled) {
				return data;
			}
		}
		return undefined;
	}

	forEachSyncFragment(getSource: (sourceId: string) => Source | undefined, callback: (fragmentId: string, fragment: DataAdapter.Fragment) => void): void {
		this.#fragments.forEach((fragment, fragmentId) => {
			const source = getSource(fragment.sourceId)?.fragmentMap.get(fragmentId);
			if (source
				&& DataAdapter.valueEquals(fragment.value, source.value)
				&& fragment.enabled === source.enabled) {
				callback(fragmentId, fragment);
			}
		});
	}

	#addSourceFragmentPair(sourceId: string, fragmentId: string): void {
		const fragmentIds = this.#sources.get(sourceId);
		if (fragmentIds) {
			fragmentIds.add(fragmentId);
		} else {
			this.#sources.set(sourceId, new Set([fragmentId]));
		}
	}

	#removeSourceFragmentPair(sourceId: string, fragmentId: string): void {
		const fragmentIds = this.#sources.get(sourceId);
		if (fragmentIds?.delete(fragmentId) && fragmentIds.size === 0) {
			this.#sources.delete(sourceId);
		}
	}

	#discardFragment(fragmentId: string, fragment: DataAdapter.Fragment, type: DiscardObsoleteFragmentType): void {
		this.#removeSourceFragmentPair(fragment.sourceId, fragmentId);
		this.#fragments.delete(fragmentId);
		if (!DataAdapter.shouldDeleteFragment(fragment, type)) {
			this.#obsolete.push([fragmentId, fragment]);
		}
		this.#modified = true;
	}
}
