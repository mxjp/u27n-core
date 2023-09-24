import { Source } from "./source.js";

export class SourceBase<F extends Source.Fragment = Source.Fragment> implements Source<F> {
	#fragments: F[] | undefined = undefined;
	#fragmentMap: Map<string, F> | undefined = undefined;

	/**
	 * Called to parse all fragments in this source.
	 */
	protected parse(): F[] {
		return [];
	}

	/**
	 * Called to create an updated version of this source.
	 */
	update?(context: Source.UpdateContext): Source.UpdateResult;

	/**
	 * Get an array of filenames that this source is compiled to.
	 *
	 * If this is not implemented or returns an empty array,
	 * fragment ids from this source are added to the
	 * manifest as global fragments.
	 */
	getOutputFilenames?(): string[];

	/**
	 * An array of all fragments in this source.
	 */
	get fragments(): readonly F[] {
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
	get fragmentMap(): ReadonlyMap<string, F> {
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
}
