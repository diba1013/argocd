#!/usr/bin/env -S NODE_OPTIONS="--no-warnings" zx
import { read } from "read";
import { $, echo, minimist, path, question } from "zx";

const GIT_REMOTE_URL_REGEX = /^(?:git@(.+):(.+)\/(.+)|https?:\/\/(.+?)\/(.+)\/(.+))\.git$/;

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
		// 1. Ask for the overlay name to determine the ArgoCD configuration to use.
		echo("Setting up cluster...");
		const environments = await $`ls infrastructure/argocd/overlays`;
		const environment = await question("Enter the environment name: ", { choices: environments.lines() });

		await $`k3d cluster delete local`.nothrow();
		await $`k3d cluster create --config ./k8s/k3d-local.yaml`;

		// 2. Install and configure ArgoCD.
		echo("Installing ArgoCD...");
		await $`kubectl create namespace argocd`;
		await $`kubectl apply -k ./infrastructure/argocd/overlays/${environment}/`;
		await $`kubectl wait --for=condition=available deployment/argocd-server -n argocd --timeout=300s`;

		// 3. Setup login credentials.
		echo("Setting up ArgoCD credentials...");
		const initialPasswordOutput = await $$`argocd admin initial-password -n argocd`;
		const password = initialPasswordOutput.lines()[0].trim();

		await $$`argocd --grpc-web --insecure --plaintext login argocd.localhost \
				--username admin \
				--password ${password}`;

		const newAdminPassword = await read({ prompt: "Enter a new admin password: ", silent: true });
		await $$`argocd --grpc-web --insecure --plaintext account update-password \
				--account admin \
				--current-password ${password} \
				--new-password ${newAdminPassword}`;
		echo("✓ Admin password updated");

		const newUserPassword = await read({ prompt: "Enter a new user password: ", silent: true });
		await $$`argocd --grpc-web --insecure --plaintext account update-password \
				--account gitops \
				--current-password ${newAdminPassword} \
				--new-password ${newUserPassword}`;
		echo("✓ User password updated");

		await $$`argocd --grpc-web --insecure --plaintext login argocd.localhost \
				--username gitops \
				--password ${newUserPassword}`;

		// 4. Setup git credentials for private repositories.
		echo("Setting up repository credentials...");
		const remoteOutput = await $$`git config remote.origin.url`;
		const [remote] = remoteOutput.lines();
		const usernameOutput = await $$`git config user.name`;
		const [username] = usernameOutput.lines();

		const token = await read({ prompt: `Enter a PAT (${remote}): `, silent: true });

		const hostUrl = remote.replace(GIT_REMOTE_URL_REGEX, "https://$1/$2");
		await $$`argocd repocreds add ${hostUrl} \
				--username ${username} \
				--password ${token}`;
		echo("✓ Repository credentials added");

		// 5. Setup applications
		echo("Setting up applications...");
		const repositoryUrl = remote.replace(GIT_REMOTE_URL_REGEX, "https://$1/$2/$3.git");
		await $`helm template --namespace argocd infrastructure/bootstrap -s templates/boostrap-application.yaml -f infrastructure/bootstrap/values.yaml --set environment=local | kubectl apply -f -`;
		await $`argocd app set bootstrap \
				--parameter repository.url=${repositoryUrl} \
				--parameter environment=${environment}`;

		echo("✓ Setup complete! ArgoCD is ready to use.");
		echo("Note: It will take a few minutes for all applications to be deployed.");
	},
	start: async () => {
		echo("Starting cluster...");
		await $`k3d cluster start local`;
		echo("✓ Cluster started");
	},
	stop: async () => {
		echo("Stopping cluster...");
		await $`k3d cluster stop local`;
		echo("✓ Cluster stopped");
	},
};

if (commands[command]) {
	try {
		await commands[command]();
	} catch (error) {
		echo(`Command '${command}' failed: ${error instanceof Error ? error.message : "Unknown error"}`);
		process.exit(1);
	}
} else {
	echo(`Error: Command '${command}' not found.`);
	process.exit(1);
}
