
export async function wait<T>(condition: () => T | Promise<T>, timeout = 2000, timeoutMessage = "timeout"): Promise<T> {
	let delay = 0;
	const end = Date.now() + timeout;
	for (;;) {
		try {
			const value = await condition();
			if (value) {
				return value;
			}
		// eslint-disable-next-line no-empty
		} catch {}
		if (Date.now() > end) {
			throw new Error(timeoutMessage);
		}
		await new Promise<void>(resolve => {
			setTimeout(resolve, delay);
			delay = Math.min(500, delay + 10);
		});
	}
}
