
export interface PluralFormEqualsRule {
	mod?: number;
	eq: number[];
}

export interface PluralFormRangeRule {
	mod?: number;
	min: number;
	max: number;
}

export interface PluralFormExcludeRule {
	exclude: number[];
}

export declare type PluralFormRule
	= PluralFormEqualsRule
	| PluralFormRangeRule
	| PluralFormExcludeRule;

export declare type PluralForm = "default" | PluralFormRule[];

export declare interface LocaleSet {
	locales: string[];
	forms: PluralForm[];
}

declare const localeSets: LocaleSet[];

export default localeSets;
