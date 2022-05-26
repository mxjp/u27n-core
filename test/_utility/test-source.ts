import { Source } from "../../src/source.js";
import { TranslationData } from "../../src/translation-data.js";
import { unindent } from "./unindent.js";

const FRAGMENT_REGEXP = /(\s*)((?:[^=\n])+)(?: id=([^\n]+))?(\n|$)/y;

function parseValue(value: string): TranslationData.Value {
	const plural = /^plural:\s([^]+)$/.exec(value);
	if (plural) {
		return {
			type: "plural",
			value: plural[1].split(/\s+/),
		};
	}
	return value;
}

function formatValue(value: TranslationData.Value): string {
	if (value === null) {
		throw new TypeError("invalid value to format");
	}
	if (typeof value === "string") {
		return value;
	}
	switch (value.type) {
		case "plural": return `plural: ${value.value.join(", ")}`;
	}
}

/**
 * A managed source where each line represents
 * a fragment in the form `<value> [id=<id>]`.
 *
 * Example:
 * ```txt
 * foo
 * bar id=42
 * baz id=7w
 * plural: foo bar id=7
 * ```
 */
export class TestSource extends Source {
	public constructor(content: string, managed = true) {
		super(unindent(content).trim());
		if (!managed) {
			this.update = undefined;
		}
	}

	public withOutputFilenames(outputFilenames: string[]): TestSource {
		this.getOutputFilenames = () => outputFilenames;
		return this;
	}

	protected parse(): Source.Fragment[] {
		const fragments: Source.Fragment[] = [];

		FRAGMENT_REGEXP.lastIndex = 0;
		let match: RegExpExecArray | null;
		// eslint-disable-next-line no-cond-assign
		while (match = FRAGMENT_REGEXP.exec(this.content)) {
			const [raw, ls, value, id, ts] = match;
			fragments.push({
				fragmentId: id,
				value: parseValue(value),
				enabled: true,
				start: match.index + ls.length,
				end: match.index + raw.length - ts.length,
			});
		}

		return fragments;
	}

	public update?(context: Source.UpdateContext): Source.UpdateResult {
		let modified = false;
		const fragments = new Map<string, Source.FragmentUpdate>();

		const updates: [Source.Fragment, string][] = [];
		this.fragments.forEach(fragment => {
			const uniqueId = context.updateId(fragment);
			fragments.set(uniqueId, {
				enabled: fragment.enabled,
				value: fragment.value,
				oldFragmentId: fragment.fragmentId,
			});
			if (uniqueId !== fragment.fragmentId) {
				updates.push([fragment, uniqueId]);
				modified = true;
			}
		});

		let content = "";
		let offset = this.content.length;
		for (let i = updates.length - 1; i >= 0; i--) {
			const [update, uniqueId] = updates[i];
			content = `${formatValue(update.value)} id=${uniqueId}${this.content.slice(update.end, offset)}${content}`;
			offset = update.start;
		}
		if (offset > 0) {
			content = this.content.slice(0, offset) + content;
		}

		return {
			modified,
			content,
			fragments,
		};
	}
}
