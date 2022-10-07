/* eslint-disable import/extensions */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import jsStringEscape from "js-string-escape";
import JSON5 from "json5";

import type { LocaleSet, PluralFormEqualsRule, PluralFormExcludeRule, PluralFormRangeRule, PluralFormRule } from "../resources/plurals";
import { Conditions } from "./utility/conditions";

const processorModuleTemplate = (
	locales: string[],
	code: string[],
) => `import type { PluralProcessor } from "../pluralization.js";

const p: PluralProcessor = (value: string[], count: number) => {
${code.map(line => `\t${line}`).join("\n")}
};

${locales.map(locale => `export const plurals_${locale} = p;`).join("\n")}
`;

const moduleIndexTemplate = (
	sets: LocaleSet[]
) => `${sets.map((_, i) => `export * from "./plurals-${i}.js";`).join("\n")}
`;

const infoModuleTemplate = (
	sets: LocaleSet[],
) => `import type { PluralInfo } from "../plural-info.js";

export const pluralInfo = new Map<string, PluralInfo>([
${sets.map(set => set.locales.map(locale => `\t["${jsStringEscape(locale)}", { formCount: ${set.forms.length} }],`).join("\n")).join("\n")}
]);
`;

(async () => {
	const resourceFilename = join(__dirname, "../resources/plurals.json5");

	const localeSets = JSON5.parse(await readFile(resourceFilename, "utf-8")) as LocaleSet[];
	const locales = new Set<string>();

	const runtimeOutputDir = join(__dirname, "../src/runtime/generated");
	await mkdir(runtimeOutputDir, { recursive: true });

	const outputDir = join(__dirname, "../src/generated");
	await mkdir(outputDir, { recursive: true });

	for (let i = 0; i < localeSets.length; i++) {
		const localeSet = localeSets[i];

		for (const locale of localeSet.locales) {
			if (typeof locale !== "string" || !/^[a-z_]+$/i.test(locale)) {
				throw new TypeError(`invalid locale: ${JSON.stringify(locale)}`);
			}
			if (locales.has(locale)) {
				throw new TypeError(`duplicate locale: ${JSON.stringify(locale)}`);
			}
			locales.add(locale);
		}

		if (!localeSet.locales.every(locale => typeof locale === "string" && /^[a-z_]+$/i.test(locale))) {
			throw new TypeError(`invalid locales: ${localeSet.locales.join(",")}`);
		}

		const localeSetName = `locales ${localeSet.locales.join(",")}`;

		const defaultForm = localeSet.forms.indexOf("default");
		if (defaultForm < 0) {
			throw new Error(`${localeSetName} has no default form.`);
		}

		const code: string[] = [];
		if (localeSet.forms.length > 1) {
			code.push(`const c = Math.floor(Math.abs(count));`);
		}

		const mods: number[] = [];
		function valueSymbol(mod?: number) {
			if (mod === undefined) {
				return "c";
			}
			let index = mods.indexOf(mod);
			if (index < 0) {
				index = mods.length;
				mods.push(mod);

				const log10 = Math.log10(mod);
				code.push(`const m${index} = c % ${
					Number.isInteger(log10)
						? `1e${log10}`
						: mod
				};`);
			}
			return `m${index}`;
		}

		for (let f = 0; f < localeSet.forms.length; f++) {
			const form = localeSet.forms[f];
			if (form !== "default") {
				const include = new Conditions("||");
				const conditions = new Conditions("&&", [include]);

				for (const rule of form as PluralFormRule[]) {
					if (isEqualsRule(rule)) {
						include.operands.push(...rule.eq.map(value => {
							return `${valueSymbol(rule.mod)} === ${value}`;
						}));
					} else if (isRangeRule(rule)) {
						include.operands.push(new Conditions("&&", [
							`${valueSymbol(rule.mod)} >= ${rule.min}`,
							`${valueSymbol(rule.mod)} <= ${rule.max}`,
						]));
					} else if (isExcludeRule(rule)) {
						conditions.operands.push(...rule.exclude.map(value => {
							return `${valueSymbol()} !== ${value}`;
						}));
					}
				}

				code.push(`if (${conditions.toString()}) {`);
				code.push(`\treturn value[${f}];`);
				code.push(`}`);
			}
		}

		code.push(`return value[${defaultForm}];`);

		await writeFile(join(runtimeOutputDir, `plurals-${i}.ts`), processorModuleTemplate(localeSet.locales, code));
	}

	await writeFile(join(runtimeOutputDir, "plurals.ts"), moduleIndexTemplate(localeSets));
	await writeFile(join(outputDir, "plural-info.ts"), infoModuleTemplate(localeSets));
})().catch(error => {
	console.error(error);
});

function isEqualsRule(rule: unknown): rule is PluralFormEqualsRule {
	if (rule === null || typeof rule !== "object") {
		return false;
	}
	const equalsRule = rule as PluralFormEqualsRule;
	return Array.isArray(equalsRule.eq) && equalsRule.eq.every(v => typeof v === "number")
		&& (equalsRule.mod === undefined || typeof equalsRule.mod === "number");
}

function isRangeRule(rule: unknown): rule is PluralFormRangeRule {
	if (rule === null || typeof rule !== "object") {
		return false;
	}
	const rangeRule = rule as PluralFormRangeRule;
	return typeof rangeRule.min === "number"
		&& typeof rangeRule.max === "number"
		&& (rangeRule.mod === undefined || typeof rangeRule.mod === "number");
}

function isExcludeRule(rule: unknown): rule is PluralFormExcludeRule {
	if (rule === null || typeof rule !== "object") {
		return false;
	}
	const excludeRule = rule as PluralFormExcludeRule;
	return Array.isArray(excludeRule.exclude) && excludeRule.exclude.every(v => typeof v === "number");
}
