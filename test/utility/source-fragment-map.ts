import test, { ExecutionContext } from "ava";

import { Source } from "../../src/source.js";
import { SourceFragmentMap } from "../../src/utility/source-fragment-map.js";

function frags(...fragmentIds: string[]): Map<string, Source.Fragment> {
	return new Map(fragmentIds.map(id => [id, {} as Source.Fragment]));
}

test("updateSource / removeSource", t => {
	const map = new SourceFragmentMap();
	verifyMap(t, map);

	map.updateSource("foo", frags("a", "b"));
	verifyMap(t, map);

	map.updateSource("foo", frags("b", "c"));
	verifyMap(t, map);

	map.updateSource("bar", frags("a", "b"));
	verifyMap(t, map);

	map.removeSource("foo");
	verifyMap(t, map);
});

test("hasOtherSources", t => {
	const map = new SourceFragmentMap();
	map.updateSource("foo", frags("a"));
	verifyMap(t, map);

	t.false(map.hasOtherSources("foo", "a"));
	t.false(map.hasOtherSources("foo", "b"));
	t.true(map.hasOtherSources("bar", "a"));

	map.updateSource("bar", frags("a"));
	verifyMap(t, map);
	t.true(map.hasOtherSources("foo", "a"));
	t.false(map.hasOtherSources("foo", "b"));
	t.true(map.hasOtherSources("bar", "a"));

	map.updateSource("baz", frags("a"));
	verifyMap(t, map);
	t.true(map.hasOtherSources("foo", "a"));
	t.false(map.hasOtherSources("foo", "b"));
	t.true(map.hasOtherSources("bar", "a"));
});

test("hasFragment", t => {
	const map = new SourceFragmentMap();

	t.false(map.hasFragment("a"));

	map.updateSource("foo", frags("a"));
	verifyMap(t, map);
	t.true(map.hasFragment("a"));

	map.updateSource("bar", frags("a"));
	verifyMap(t, map);
	t.true(map.hasFragment("a"));

	map.removeSource("foo");
	verifyMap(t, map);
	t.true(map.hasFragment("a"));

	map.removeSource("bar");
	verifyMap(t, map);
	t.false(map.hasFragment("a"));
});

function verifyMap(t: ExecutionContext, map: SourceFragmentMap): void {
	const fragmentToSources = new Map<string, Set<string>>();
	map.sourceToFragments.forEach((fragments, source) => {
		fragments.forEach(fragment => {
			const sources = fragmentToSources.get(fragment);
			if (sources === undefined) {
				fragmentToSources.set(fragment, new Set([source]));
			} else {
				sources.add(source);
			}
		});
	});

	t.is(map.fragmentToSources.size, fragmentToSources.size);
	fragmentToSources.forEach((sources, fragment) => {
		const sourcesFromMap = map.fragmentToSources.get(fragment);
		t.is(sourcesFromMap?.size, sources.size);
		t.deepEqual(sources, sourcesFromMap);
	});
}
