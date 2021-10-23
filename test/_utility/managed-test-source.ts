import { Source } from "../../src/source.js";
import { unindent } from "./unindent.js";

const FRAGMENT_REGEXP = /(\s*)(\S+)(?: (\S+))?(\n|$)/y;

/**
 * A managed source where each line represents
 * a fragment in the form `<value> [<id>]`.
 *
 * Example:
 * ```txt
 * foo
 * bar 42
 * baz 7w
 * ```
 */
export class ManagedTestSource extends Source {
	public constructor(content: string) {
		super(unindent(content).trim());
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
				value: value,
				enabled: true,
				start: match.index + ls.length,
				end: match.index + raw.length - ts.length,
			});
		}

		return fragments;
	}

	public update(context: Source.UpdateContext): Source.UpdateResult {
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
			content = `${update.value!} ${uniqueId}${this.content.slice(update.end, offset)}${content}`;
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
