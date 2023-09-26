
export type Task<T extends unknown[], R> = (...args: T) => Promise<R>;

/**
 * Wrap an async function to wait for previous calls to complete first.
 */
export function taskQueue<T extends unknown[], R>(task: Task<T, R>): Task<T, R> {
	let pending: Promise<unknown> = Promise.resolve();
	return (...args) => {
		const promise = pending.then(() => task(...args));
		pending = promise.catch(() => {});
		return promise;
	};
}
