#!/usr/bin/env -S NODE_OPTIONS="--no-warnings" zx
import { read } from "read";
import { $, echo, minimist, path } from "zx";

// We need to remove the first two arguments because of the shebang handling.
const { _: parameters } = minimist(process.argv.slice(3));
const [command = "start"] = parameters;

// Ensure we are in the root directory of the project.
$.cwd = path.resolve(import.meta.dirname, "..");
// Print some more debug information like process output.
$.verbose = true;

const $$ = $({ quiet: true });

type CommandAction = () => Promise<void>;
type Commands = Record<string, CommandAction | undefined>;

const commands: Commands = {
	init: async () => {
		// Ensure that the cluster is created fresh.
		await $`k3d cluster delete local`.nothrow();
		await $`k3d cluster create --config ./k8s/k3d-local.yaml`;

		// Bootstrap the ArgoCD instance and wait for it to be ready.
		await $`kubectl create namespace argocd`;
		await $`kubectl apply -k ./argocd/overlays/local/`;
		await $`kubectl wait --for=condition=available deployment/argocd-server -n argocd --timeout=300s`;

		echo("Finishing last steps for ArgoCD...");
		// Read the initial password from the ArgoCD instance.
		const initialPasswordOutput = await $$`argocd admin initial-password -n argocd`;
		const password = initialPasswordOutput.lines()[0].trim();
		// Login to the ArgoCD instance using the initial password.
		await $$`argocd --grpc-web --insecure --plaintext login argocd.localhost \
				--username admin \
				--password ${password} \
			`;
		// Update admin password using the initial password to ensure that it cannot be used anymore.
		const newAdminPassword = await read({ prompt: "Enter a new admin password: ", silent: true });
		await $$`argocd --grpc-web --insecure --plaintext account update-password \
				--account admin \
				--current-password ${password} \
				--new-password ${newAdminPassword}
			`;
		echo("Admin password updated.");
		// Update user password using the new admin password since we are authenticated as admin.
		const newUserPassword = await read({ prompt: "Enter a new user password: ", silent: true });
		await $$`argocd --grpc-web --insecure --plaintext account update-password \
				--account gitops \
				--current-password ${newAdminPassword} \
				--new-password ${newUserPassword}
			`;
		echo("User password updated.");
		// Login with the new user that essentially has the same permissions as the admin.
		await $$`argocd --grpc-web --insecure --plaintext login argocd.localhost \
				--username gitops \
				--password ${newUserPassword}
			`;
		echo("ArgoCD is ready to use.");
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
