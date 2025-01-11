import { version } from "./package.json";
import { defineConfig } from "@diba1013/tscz";

const NAME = "ts";

export default defineConfig({
	name: NAME,
	entries: [
		{
			name: "index",
			input: "src/index.ts",
			output: ["cjs", "esm", "dts"],
		},
	],
	env: {
		__NAME__: NAME,
		__VERSION__: version,
	},
});
