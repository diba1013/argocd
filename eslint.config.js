import { defineConfig } from "@diba1013/linter/eslint";

export default defineConfig({
	platform: "node",
	typescript: "./tsconfig.json",
	configs: [
		{
			files: ["scripts/**/*.ts"],
			rules: {
				"@typescript-eslint/no-unsafe-call": "off",
			},
		},
	],
});
