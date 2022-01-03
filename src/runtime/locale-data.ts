
export type LocaleData = Record<string, LocaleData.Namespace>;

export declare namespace LocaleData {
	export type Namespace = Record<string, Value>;
	export type Value = string | string[];
}
