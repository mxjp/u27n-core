import { Source } from "../source.js";

export class SourceFragmentMap {
	private readonly _sourceToFragments = new Map<string, Set<string>>();
	private readonly _fragmentToSources = new Map<string, Set<string>>();

	/**
	 * Get a view on the current mapping from fragment ids to sets of source ids.
	 */
	public get fragmentToSources(): ReadonlyMap<string, ReadonlySet<string>> {
		return this._fragmentToSources;
	}

	/**
	 * Update all fragments of the specified source.
	 */
	public updateSource(sourceId: string, fragmentMap: Map<string, Source.Fragment>): void {
		let fragmentIds = this._sourceToFragments.get(sourceId);
		if (fragmentIds === undefined) {
			if (fragmentMap.size > 0) {
				fragmentIds = new Set();
				this._sourceToFragments.set(sourceId, fragmentIds);
			}
		} else {
			fragmentIds.forEach(fragmentId => {
				if (!fragmentMap.has(fragmentId)) {
					deletePair(this._fragmentToSources, fragmentId, sourceId);
					fragmentIds!.delete(fragmentId);
				}
			});
		}

		if (fragmentMap.size > 0) {
			fragmentMap.forEach((_fragment, fragmentId) => {
				fragmentIds!.add(fragmentId);

				const sourceIds = this._fragmentToSources.get(fragmentId);
				if (sourceIds === undefined) {
					this._fragmentToSources.set(fragmentId, new Set([sourceId]));
				} else {
					sourceIds.add(sourceId);
				}
			});
		} else if (fragmentIds !== undefined) {
			this._sourceToFragments.delete(sourceId);
		}
	}

	/**
	 * Remove all fragments of the specified source.
	 */
	public removeSource(sourceId: string): void {
		this._sourceToFragments.get(sourceId)?.forEach(fragmentId => {
			deletePair(this._fragmentToSources, fragmentId, sourceId);
		});
		this._sourceToFragments.delete(sourceId);
	}

	/**
	 * Check if there are any sources other than the specified one that also provide the same fragment.
	 */
	public hasOtherSources(sourceId: string, fragmentId: string): boolean {
		const sourceIds = this._fragmentToSources.get(fragmentId);
		return sourceIds !== undefined
			&& sourceIds.size > (sourceIds.has(sourceId) ? 1 : 0);
	}

	/**
	 * Check if there are any fragments with the specified id.
	 */
	public hasFragment(fragmentId: string): boolean {
		return this._fragmentToSources.has(fragmentId);
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
