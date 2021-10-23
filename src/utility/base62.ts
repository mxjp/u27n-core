
const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function base62encode(value: number): string {
	if (!Number.isSafeInteger(value) || value < 0) {
		throw new RangeError("value must be a non negative integer");
	}
	if (value === 0) {
		return "0";
	}
	let output = "";
	while (value > 0) {
		output = BASE62[value % 62] + output;
		value = Math.floor(value / 62);
	}
	return output;
}
