import test from "ava";

import { BinarySearchComparator, binarySearchIndex } from "../../src/utility/binary-search.js";

test("binarySearchIndex", t => {
	const comparator: BinarySearchComparator<number> = value => 3 - value;
	t.is(binarySearchIndex([], comparator), undefined);
	t.is(binarySearchIndex([1, 2, 4], comparator), undefined);
	t.is(binarySearchIndex([1, 2, 3, 4], comparator), 2);
	t.is(binarySearchIndex([-2, 1, 1, 2, 3, 7], comparator), 4);
	t.is(binarySearchIndex([-2, 1, 1, 2, 3], comparator), 4);
	t.is(binarySearchIndex([3, 7, 13], comparator), 0);
});
