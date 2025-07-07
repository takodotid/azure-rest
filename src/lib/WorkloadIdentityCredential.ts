import { existsSync, readFileSync } from "node:fs";
import type { AzureCredential } from "./AzureCredential.js";
import { ServicePrincipalCredential } from "./ServicePrincipalCredential.js";

/**
 * Options for configuring WorkloadIdentityCredential.
 *
 * @property clientId - The Azure AD application (client) ID
 * @property federatedTokenFile - Path to the federated token file (OIDC/JWT)
 * @property tenantId - The Azure AD tenant ID
 * @property authorityHost - (Optional) The Azure AD authority host
 */
export type WorkloadIdentityCredentialOption = {
	clientId: string;
	federatedTokenFile: string;
	tenantId: string;
	authorityHost?: string;
};

/**
 * AzureCredential implementation for Azure Workload Identity (OIDC federated token).
 *
 * Reads a federated token from file and authenticates as a service principal using JWT assertion.
 */
export class WorkloadIdentityCredential implements AzureCredential {
	/**
	 * @param options Workload identity credential options
	 */
	public constructor(public options: WorkloadIdentityCredentialOption) {}

	/**
	 * Gets an Azure access token using the federated token file.
	 * @param scope The resource scope for the token
	 * @returns An object with token and expiresAt
	 * @throws If the federated token file does not exist
	 */
	public async getToken(scope: string) {
		if (!existsSync(this.options.federatedTokenFile)) {
			throw new Error("WorkloadIdentityCredential: The federated token file does not exist.");
		}

		const token = readFileSync(this.options.federatedTokenFile, "utf-8");
		const servicePrincipal = new ServicePrincipalCredential({ ...this.options, clientSecret: token, federated: true });

		return servicePrincipal.getToken(scope);
	}

	/**
	 * Instantiates WorkloadIdentityCredential using environment variables.
	 * This expects the following environment variables to be set:
	 * - AZURE_AUTHORITY_HOST: The Azure AD authority host (optional)
	 * - AZURE_CLIENT_ID: The Azure AD application (client) ID
	 * - AZURE_FEDERATED_TOKEN_FILE: Path to the federated token file
	 * - AZURE_TENANT_ID: The Azure AD tenant ID
	 * @returns WorkloadIdentityCredential instance
	 */
	public static fromEnv() {
		return new WorkloadIdentityCredential({
			authorityHost: process.env.AZURE_AUTHORITY_HOST,
			clientId: process.env.AZURE_CLIENT_ID,
			federatedTokenFile: process.env.AZURE_FEDERATED_TOKEN_FILE,
			tenantId: process.env.AZURE_TENANT_ID
		});
	}
}

declare global {
	namespace NodeJS {
		interface ProcessEnv {
			AZURE_AUTHORITY_HOST: string;
			AZURE_CLIENT_ID: string;
			AZURE_FEDERATED_TOKEN_FILE: string;
			AZURE_TENANT_ID: string;
		}
	}
}
