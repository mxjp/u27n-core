
export enum DiscardObsoleteFragmentType {
	/** Discard fragments that have no translations. */
	Untranslated = "untranslated",
	/** Discard fragments that have no or only outdated translations. */
	Outdated = "outdated",
	/** Discard all fragments */
	All = "all",
}

export const discardObsoleteFragmentTypes = new Set<DiscardObsoleteFragmentType>([
	DiscardObsoleteFragmentType.Untranslated,
	DiscardObsoleteFragmentType.Outdated,
	DiscardObsoleteFragmentType.All,
]);
