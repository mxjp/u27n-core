
export type BinarySearchComparator<T> = (value: T, index: number, array: T[]) => number;

export function binarySearchIndex<T>(array: T[], comparator: BinarySearchComparator<T>): number | undefined {
	let start = 0;
	let end = array.length - 1;
	while (start <= end) {
		const mid = (start + end) >> 1;
		const comp = comparator(array[mid], mid, array);
		if (comp < 0) {
			end = mid - 1;
		} else if (comp > 0) {
			start = mid + 1;
		} else {
			return mid;
		}
	}
}
