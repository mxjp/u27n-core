
export function debounce(delay: number, fn: () => void): () => void {
	let timer: NodeJS.Timer | null = null;
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
