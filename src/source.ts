import { LineMap } from "@mpt/line-map";
import { isAbsolute, join, normalize, relative } from "path";

import type { FragmentIdGenerator } from "./fragment-id-generator.js";
import type { TranslationData } from "./translation-data.js";

export class Source<F extends Source.Fragment = Source.Fragment> {
	public readonly content: string;
	public readonly fragmentIdGenerator?: FragmentIdGenerator;

	#lineMap: LineMap | undefined = undefined;
	#fragments: F[] | undefined = undefined;
	#fragmentMap: Map<string, F> | undefined = undefined;

	public constructor(content: string) {
		this.content = content;
	}

	/**
	 * Called to parse all fragments in this source.
	 */
	protected parse(): F[] {
		return [];
	}

	/**
	 * Called to create an updated version of this source.
	 */
	public update?(context: Source.UpdateContext): Source.UpdateResult;

	/**
	 * A line map for this source that can be used
	 * for converting between line/character positions and offsets.
	 */
	public get lineMap(): LineMap {
		if (this.#lineMap === undefined) {
			this.#lineMap = new LineMap(this.content);
		}
		return this.#lineMap;
	}

	/**
	 * An array of all fragments in this source.
	 */
	public get fragments(): readonly F[] {
		if (this.#fragments === undefined) {
			this.#fragments = this.parse ? this.parse() : [];
		}
		return this.#fragments;
	}

	/**
	 * A map of ids to fragments.
	 *
	 * Note that this may not contain all fragments if there are any duplicate fragment ids.
	 */
	public get fragmentMap(): ReadonlyMap<string, F> {
		if (this.#fragmentMap === undefined) {
			const map = new Map<string, F>();
			const fragments = this.fragments;
			for (let i = 0; i < fragments.length; i++) {
				const fragment = fragments[i];
				if (fragment.fragmentId !== undefined) {
					map.set(fragment.fragmentId, fragment);
				}
			}
			this.#fragmentMap = map;
		}
		return this.#fragmentMap;
	}

	/**
	 * Convert an absolute filename to a relative source filename that can be used in a translation data object.
	 *
	 * @param rootDir The absolute path of the project root directory.
	 * @param filename The absolute or relative filename of the source.
	 */
	public static filenameToSourceId(rootDir: string, filename: string): string {
		return (isAbsolute(filename) ? relative(rootDir, filename) : normalize(filename)).replace(/\\/g, "/");
	}

	/**
	 * Convert a relative source filename to an absolute filename.
	 *
	 * @param rootDir The absolute path of the project root directory.
	 * @param sourceId The source id.
	 */
	public static sourceIdToFilename(rootDir: string, sourceId: string): string {
		return join(rootDir, sourceId);
	}
}

export declare namespace Source {
	export interface Fragment {
		/** The id of the fragment or undefined if no id is assigned */
		fragmentId?: string;
		/** The value of the fragment or undefined if the current value is invalid for any reason */
		value: TranslationData.Value;
		/** False if the fragment is commented out */
		enabled: boolean;
		/** The inclusive start offset */
		start: number;
		/** The exclusive end offset */
		end: number;
	}

	export interface UpdateContext {
		/**
		 * This should be called by the update implementation for each fragment to get a project wide unique id for that fragment.
		 *
		 * @returns The updated id to replace the current id.
		 */
		updateId(fragment: Fragment): string;
	}

	export interface UpdateResult {
		/** True if the source content has been modified */
		modified: boolean;
		/** The update source content */
		content: string;
		/** A map of all fragment ids to fragment updates (also including fragments that have not been updated) */
		fragments: Map<string, FragmentUpdate>;
	}

	export interface FragmentUpdate {
		/** The source value of the fragment */
		value: TranslationData.Value;
		/** False if the fragment is commented out */
		enabled: boolean;
		/** The old id or undefined if the fragment did not have an id */
		oldFragmentId: string | undefined;
	}
}
