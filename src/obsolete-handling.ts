
export type DiscardObsoleteFragmentType = "untranslated" | "outdated" | "all";

export const discardObsoleteFragmentTypes = new Set<DiscardObsoleteFragmentType>([
	"untranslated",
	"outdated",
	"all",
]);
