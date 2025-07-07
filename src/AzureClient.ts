import type { AzureCredential, Credential } from "./lib/AzureCredential.js";

/**
 * Options for configuring the AzureClient instance.
 *
 * @property baseUrl - The base URL for Azure REST API endpoints (e.g. https://management.azure.com)
 * @property credential - Credential configuration for authenticating requests
 *   @property helper - An AzureCredential implementation for acquiring tokens
 *   @property scope - The Azure resource scope for the token (e.g. https://management.azure.com/.default)
 *   @property builder - (Optional) Function to build request headers from a token. If not provided, an Authorization header is set by default.
 */
export type AzureClientOptions = {
	baseUrl: string;
	credential: {
		helper: AzureCredential;
		scope: string;
		builder?: (token: Credential) => Record<string, string>;
	};
};

/**
 * Azure REST API client with credential refresh and HTTP verb helpers.
 */
export class AzureClient {
	private static readonly MAX_TOKEN_RETRIES = 3;
	private token: Credential | null = null;

	/**
	 * @param options Azure client configuration (baseUrl, credential, etc)
	 */
	constructor(public options: AzureClientOptions) {
		Object.defineProperty(this, "token", { enumerable: false });
	}

	/**
	 * Sends a request to the Azure REST API, handling token refresh and retries.
	 * @param path The API path (relative to baseUrl)
	 * @param init Optional fetch options
	 * @returns The fetch Response object
	 * @throws If token refresh fails after max retries
	 */
	public async sendRequest(path: string, init?: RequestInit): Promise<Response> {
		for (let i = 0; i <= AzureClient.MAX_TOKEN_RETRIES; i++) {
			if (this.token && this.token.expiresAt > new Date()) break;
			if (i === AzureClient.MAX_TOKEN_RETRIES) {
				throw new Error("Failed to refresh token after multiple attempts");
			}
			await this.refreshToken();
			if (i > 0) await new Promise(res => setTimeout(res, 100 * i));
		}

		if (!this.token) throw new Error("Token is unexpectedly null after refresh attempts");

		return fetch(`${this.options.baseUrl}${path}`, {
			...init,
			headers: {
				...(this.options.credential.builder ? this.options.credential.builder(this.token) : { Authorization: `Bearer ${this.token.accessToken}` }),
				...init?.headers
			}
		});
	}

	/**
	 * Sends a GET request to the Azure REST API.
	 * @param path The API path
	 * @param init Optional fetch options
	 * @returns The fetch Response object
	 */
	public get(path: string, init?: RequestInit) {
		return this.sendRequest(path, { ...init, method: "GET" });
	}

	/**
	 * Sends a POST request with a JSON body to the Azure REST API.
	 * @param path The API path
	 * @param body The request body (will be JSON.stringified)
	 * @param init Optional fetch options
	 * @returns The fetch Response object
	 */
	public post(path: string, body?: any, init?: RequestInit) {
		return this.sendRequest(path, {
			...init,
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...init?.headers
			},
			body: body !== undefined ? JSON.stringify(body) : undefined
		});
	}

	/**
	 * Sends a PUT request with a JSON body to the Azure REST API.
	 * @param path The API path
	 * @param body The request body (will be JSON.stringified)
	 * @param init Optional fetch options
	 * @returns The fetch Response object
	 */
	public put(path: string, body?: any, init?: RequestInit) {
		return this.sendRequest(path, {
			...init,
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				...init?.headers
			},
			body: body !== undefined ? JSON.stringify(body) : undefined
		});
	}

	/**
	 * Sends a PATCH request with a JSON body to the Azure REST API.
	 * @param path The API path
	 * @param body The request body (will be JSON.stringified)
	 * @param init Optional fetch options
	 * @returns The fetch Response object
	 */
	public patch(path: string, body?: any, init?: RequestInit) {
		return this.sendRequest(path, {
			...init,
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				...init?.headers
			},
			body: body !== undefined ? JSON.stringify(body) : undefined
		});
	}

	/**
	 * Sends a DELETE request to the Azure REST API.
	 * @param path The API path
	 * @param init Optional fetch options
	 * @returns The fetch Response object
	 */
	public delete(path: string, init?: RequestInit) {
		return this.sendRequest(path, { ...init, method: "DELETE" });
	}

	/**
	 * Refreshes the Azure access token using the provided credential helper.
	 * @private
	 */
	private async refreshToken(): Promise<void> {
		this.token = await this.options.credential.helper.getToken(this.options.credential.scope);
	}
}
