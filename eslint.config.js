import { defineConfig } from "@diba1013/linter/eslint";

export default defineConfig({
	platform: "node",
	typescript: "./tsconfig.json",
	configs: [
		{
			files: ["infrastructure/*/templates/*.yaml", "k8s/charts/*/templates/*.yaml"],
			rules: {
				/**
				 * Do not complain about go templating not evaluating to a value.
				 * https://ota-meshi.github.io/eslint-plugin-yml/rules/no-empty-mapping-value.html
				 */
				"yml/no-empty-mapping-value": "off",
			},
		},
	],
	ignores: ["k8s/data/**", "infrastructure/*/templates/*.yaml"],
});
