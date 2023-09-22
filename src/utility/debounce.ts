import { clearTimeout, setTimeout } from "node:timers";

export function debounce(delay: number, fn: () => void): () => void {
	let timer: NodeJS.Timeout | null = null;
	return () => {
		if (timer !== null) {
			clearTimeout(timer);
		}
		timer = setTimeout(() => {
			timer = null;
			fn();
		}, delay);
	};
}
