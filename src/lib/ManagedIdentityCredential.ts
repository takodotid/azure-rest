import type { AzureCredential } from "./AzureCredential.js";
import type { OAuth2TokenResponse } from "./ServicePrincipalCredential.js";

/**
 * Options for configuring ManagedIdentityCredential.
 *
 * @property clientId - (Optional) The user-assigned managed identity client ID.
 * @property timeoutMs - (Optional) Timeout in milliseconds for metadata endpoint fetch. Default: 300ms.
 */
export type ManagedIdentityCredentialOptions = {
	identityEndpoint?: string; // Optional: custom endpoint, defaults to Azure's default metadata endpoint
	clientId?: string;
	timeoutMs?: number; // Optional: custom timeout for fetch
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
		const endpoint = this.options.identityEndpoint || "http://169.254.169.254/metadata/identity/oauth2/token";
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

		// Add timeout to fetch (default 500ms, can override via options)
		const timeoutMs = this.options.timeoutMs ?? 300;
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), timeoutMs);

		let response: Response;
		try {
			response = await fetch(url, { headers, signal: controller.signal });
		} catch (err: any) {
			if (err.name === "AbortError") {
				throw new Error(`ManagedIdentityCredential: Timed out after ${timeoutMs}ms waiting for metadata endpoint (${url})`);
			}
			throw err;
		} finally {
			clearTimeout(timeout);
		}

		if (!response.ok) {
			throw new Error(`ManagedIdentityCredential: Failed to get token: ${await response.text()}`);
		}

		const data = (await response.json()) as OAuth2TokenResponse;
		return {
			accessToken: data.access_token,
			clientId: data.client_id,
			expiresAt: new Date(data.expires_on ? Number(data.expires_on) * 1000 : Date.now() + 60 * 60 * 1000), // fallback 1h
			tokenType: data.token_type
		};
	}

	/**
	 * Instantiates ManagedIdentityCredential using environment variables.
	 * This expects the following environment variables to be set:
	 * - AZURE_CLIENT_ID: The user-assigned managed identity client ID. This is optional for system-assigned identities.
	 * - AZURE_MANAGED_IDENTITY_ENDPOINT or IDENTITY_ENDPOINT: The managed identity endpoint (optional, defaults to http://169.254.169.254/metadata/identity/oauth2/token)
	 * - AZURE_MANAGED_IDENTITY_TIMEOUT_MS: Custom timeout for metadata endpoint fetch in milliseconds (optional).
	 * @returns ManagedIdentityCredential instance
	 */
	public static fromEnv() {
		return new ManagedIdentityCredential({
			identityEndpoint: process.env.AZURE_MANAGED_IDENTITY_ENDPOINT || process.env.IDENTITY_ENDPOINT,
			clientId: process.env.AZURE_CLIENT_ID,
			timeoutMs: process.env.AZURE_MANAGED_IDENTITY_TIMEOUT_MS ? Number.parseInt(process.env.AZURE_MANAGED_IDENTITY_TIMEOUT_MS) : undefined
		});
	}
}

declare global {
	namespace NodeJS {
		interface ProcessEnv {
			AZURE_MANAGED_IDENTITY_ENDPOINT?: string;
			AZURE_MANAGED_IDENTITY_TIMEOUT_MS?: string; // Optional: custom timeout for fetch
			IDENTITY_ENDPOINT?: string;
		}
	}
}
