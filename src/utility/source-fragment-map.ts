import { Source } from "../source.js";

export class SourceFragmentMap {
	readonly #sourceToFragments = new Map<string, Set<string>>();
	readonly #fragmentToSources = new Map<string, Set<string>>();

	/**
	 * Get a view on the current mapping from source ids to sets of fragment ids.
	 */
	get sourceToFragments(): ReadonlyMap<string, ReadonlySet<string>> {
		return this.#sourceToFragments;
	}

	/**
	 * Get a view on the current mapping from fragment ids to sets of source ids.
	 */
	get fragmentToSources(): ReadonlyMap<string, ReadonlySet<string>> {
		return this.#fragmentToSources;
	}

	/**
	 * Update all fragments of the specified source.
	 */
	updateSource(sourceId: string, fragmentMap: ReadonlyMap<string, Source.Fragment>): void {
		let fragmentIds = this.#sourceToFragments.get(sourceId);
		if (fragmentIds === undefined) {
			if (fragmentMap.size > 0) {
				fragmentIds = new Set();
				this.#sourceToFragments.set(sourceId, fragmentIds);
			}
		} else {
			fragmentIds.forEach(fragmentId => {
				if (!fragmentMap.has(fragmentId)) {
					deletePair(this.#fragmentToSources, fragmentId, sourceId);
					fragmentIds!.delete(fragmentId);
				}
			});
		}

		if (fragmentMap.size > 0) {
			fragmentMap.forEach((_fragment, fragmentId) => {
				fragmentIds!.add(fragmentId);

				const sourceIds = this.#fragmentToSources.get(fragmentId);
				if (sourceIds === undefined) {
					this.#fragmentToSources.set(fragmentId, new Set([sourceId]));
				} else {
					sourceIds.add(sourceId);
				}
			});
		} else if (fragmentIds !== undefined) {
			this.#sourceToFragments.delete(sourceId);
		}
	}

	/**
	 * Remove all fragments of the specified source.
	 */
	removeSource(sourceId: string): void {
		this.#sourceToFragments.get(sourceId)?.forEach(fragmentId => {
			deletePair(this.#fragmentToSources, fragmentId, sourceId);
		});
		this.#sourceToFragments.delete(sourceId);
	}

	/**
	 * Check if there are any sources other than the specified one that also provide the same fragment.
	 */
	hasOtherSources(sourceId: string, fragmentId: string): boolean {
		const sourceIds = this.#fragmentToSources.get(fragmentId);
		return sourceIds !== undefined
			&& sourceIds.size > (sourceIds.has(sourceId) ? 1 : 0);
	}

	/**
	 * Check if there are any fragments with the specified id.
	 */
	hasFragment(fragmentId: string): boolean {
		return this.#fragmentToSources.has(fragmentId);
	}
}

function deletePair<K, V>(map: Map<K, Set<V>>, key: K, value: V): void {
	const values = map.get(key);
	if (values !== undefined) {
		values.delete(value);
		if (values.size === 0) {
			map.delete(key);
		}
	}
}
