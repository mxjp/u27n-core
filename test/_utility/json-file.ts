
export function jsonFile<T = unknown>(data: T): string {
	return JSON.stringify(data, null, "\t") + "\n";
}
