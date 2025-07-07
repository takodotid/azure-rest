import { AzureCliCredential } from "./AzureCliCredential.js";
import type { AzureCredential } from "./AzureCredential.js";
import { ManagedIdentityCredential } from "./ManagedIdentityCredential.js";
import { ServicePrincipalCredential } from "./ServicePrincipalCredential.js";
import { WorkloadIdentityCredential } from "./WorkloadIdentityCredential.js";

const credentialChain = [WorkloadIdentityCredential, ManagedIdentityCredential, ServicePrincipalCredential, AzureCliCredential];

/**
 * DefaultChainedCredential tries multiple credential providers in order until one succeeds.
 *
 * The chain is: WorkloadIdentityCredential → ManagedIdentityCredential → ServicePrincipalCredential → AzureCliCredential.
 * Useful for local dev, CI, and cloud environments with minimal config.
 */
export class DefaultChainedCredential implements AzureCredential {
	/**
	 * Attempts to get an Azure access token using the first available credential in the chain.
	 * @param scope The resource scope for the token
	 * @returns An object with token and expiresAt
	 * @throws If all credential providers fail
	 */
	public async getToken(scope: string) {
		const errors: { name: string; error: Error }[] = [];
		for (const Credential of credentialChain) {
			try {
				return await Credential.fromEnv().getToken(scope);
			} catch (error) {
				errors.push({ error: error as Error, name: Credential.name });
			}
		}

		throw new Error(`Failed to get token, errors:\n${errors.map(err => `[${err.name}] ${err.error.message}`).join("\n")}`);
	}
}
