#!/usr/bin/env -S NODE_OPTIONS="--no-warnings" zx

// Utilize patched packages from zx.
import { $, minimist, path } from "zx";

// We need to remove the first two arguments because of the shebang handling.
const { _: parameters } = minimist(process.argv.slice(3));
const [command = "start"] = parameters;

// Ensure we are in the root directory of the project.
$.cwd = path.resolve(import.meta.dirname, "..");
// Print some more debug information like process output.
$.verbose = true;

type CommandAction = () => Promise<void>;
type Commands = Record<string, CommandAction | undefined>;

const commands: Commands = {
	init: async () => {
		await $`k3d cluster delete local || true`;
		await $`k3d cluster create --config ./k8s/k3d-local.yaml`;
	},
	start: async () => {
		await $`k3d cluster start local`;
	},
	stop: async () => {
		await $`k3d cluster stop local`;
	},
};

if (commands[command]) {
	await commands[command]();
} else {
	console.error(`Error: Command '${command}' not found.`);
	process.exit(1);
}
