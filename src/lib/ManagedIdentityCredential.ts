import type { AzureCredential } from "./AzureCredential.js";
import type { OAuth2TokenResponse } from "./ServicePrincipalCredential.js";

/**
 * Options for configuring ManagedIdentityCredential.
 *
 * @property clientId - (Optional) The user-assigned managed identity client ID
 */
export type ManagedIdentityCredentialOptions = {
	clientId?: string;
};

/**
 * AzureCredential implementation for Azure Managed Identity (MSI).
 *
 * Supports both system-assigned and user-assigned managed identities.
 * Works on Azure VM, App Service, Container Apps, etc.
 */
export class ManagedIdentityCredential implements AzureCredential {
	/**
	 * @param options Managed identity credential options
	 */
	public constructor(public options: ManagedIdentityCredentialOptions = {}) {}

	/**
	 * Gets an Azure access token using the managed identity endpoint.
	 * @param scope The resource scope for the token
	 * @returns An object with token and expiresAt
	 * @throws If the endpoint is unavailable or token request fails
	 */
	public async getToken(scope: string) {
		const endpoint = process.env.AZURE_MANAGED_IDENTITY_ENDPOINT || process.env.IDENTITY_ENDPOINT || "http://169.254.169.254/metadata/identity/oauth2/token";
		const apiVersion = "2018-02-01";
		const params = new URLSearchParams({
			resource: scope.replace(".default", ""),
			apiVersion
		});
		if (this.options.clientId) {
			params.set("client_id", this.options.clientId);
		}

		const url = `${endpoint}?${params.toString()}`;
		const headers = { Metadata: "true" };

		const response = await fetch(url, { headers });
		if (!response.ok) {
			throw new Error(`ManagedIdentityCredential: Failed to get token: ${await response.text()}`);
		}

		const data = (await response.json()) as OAuth2TokenResponse;
		return {
			token: data.access_token,
			expiresAt: new Date(data.expires_on ? Number(data.expires_on) * 1000 : Date.now() + 60 * 60 * 1000) // fallback 1h
		};
	}

	/**
	 * Instantiates ManagedIdentityCredential using environment variables.
	 * @returns ManagedIdentityCredential instance
	 */
	public static fromEnv() {
		return new ManagedIdentityCredential({ clientId: process.env.AZURE_CLIENT_ID });
	}
}

declare global {
	namespace NodeJS {
		interface ProcessEnv {
			AZURE_MANAGED_IDENTITY_ENDPOINT?: string;
			IDENTITY_ENDPOINT?: string;
		}
	}
}
