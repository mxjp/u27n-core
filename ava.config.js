"use strict";

export default {
	files: [
		// "./test_out/test/**/*.js",
		"./test_out/test/cli.js",
		"!**/_*/*",
	],
	ignoredByWatcher: [
		"./src/**/*",
		"./test/**/*",
		"./test_data/**/*",
	],
};
