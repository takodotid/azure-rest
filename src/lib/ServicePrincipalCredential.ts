/* eslint-disable typescript/naming-convention */

import { URLSearchParams } from "node:url";
import type { AzureCredential } from "./AzureCredential.js";

/**
 * The OAuth2 token response returned by Azure AD and Managed Identity endpoints.
 *
 * @property access_token - The access token string
 * @property client_id - The client/application ID (optional, present in MSI)
 * @property expires_in - Seconds until token expiry
 * @property expires_on - Expiry time (epoch seconds, as string)
 * @property ext_expires_in - Extended expiry in seconds
 * @property not_before - Not before time (epoch seconds, as string)
 * @property resource - The resource for which the token is issued
 * @property token_type - The type of token (usually 'Bearer')
 */
export type OAuth2TokenResponse = {
	access_token: string;
	client_id?: string;
	expires_in: number;
	expires_on: string;
	ext_expires_in: number;
	not_before: string;
	resource: string;
	token_type: string;
};

/**
 * Options for configuring ServicePrincipalCredential.
 *
 * @property clientId - The Azure AD application (client) ID
 * @property clientSecret - The client secret or JWT assertion (for federated)
 * @property tenantId - The Azure AD tenant ID
 * @property authorityHost - (Optional) The Azure AD authority host
 * @property federated - Whether to use federated (JWT) auth
 */
export type ServicePrincipalCredentialOption = {
	clientId: string;
	clientSecret?: string;
	tenantId: string;
	authorityHost?: string;
	federated: boolean;
};

/**
 * AzureCredential implementation for authenticating with a Service Principal (client secret or federated/JWT).
 */
export class ServicePrincipalCredential implements AzureCredential {
	/**
	 * @param options Service principal credential options
	 */
	public constructor(public options: ServicePrincipalCredentialOption) {}

	/**
	 * Gets an Azure access token using the service principal credentials.
	 * @param scope The resource scope for the token
	 * @returns An object with token and expiresAt
	 * @throws If client secret is missing or token request fails
	 */
	public async getToken(scope: string) {
		if (!this.options.clientSecret) throw new Error("ServicePrincipalCredential: The client secret is not provided.");

		// Remove trailing slash from identityAuthorityHost
		const url = [this.options.authorityHost?.replace(/\/$/, "") ?? "https://login.microsoftonline.com", `${this.options.tenantId}/oauth2/v2.0/token`].join("/");

		try {
			const searchParams = {
				client_id: this.options.clientId,
				grant_type: "client_credentials",
				scope
			};

			// If federated, use client_assertion and client_assertion_type
			// Otherwise, use client_secret
			if (this.options.federated) {
				Object.assign(searchParams, {
					client_assertion: this.options.clientSecret,
					client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"
				});
			} else {
				Object.assign(searchParams, {
					client_secret: this.options.clientSecret
				});
			}
			const response = await fetch(url, {
				method: "POST",
				headers: {
					Accept: "application/json",
					"Content-Type": "application/x-www-form-urlencoded"
				},
				body: new URLSearchParams(searchParams)
			});

			if (!response.ok) {
				throw new Error(`Failed to get token: ${await response.text()}`);
			}

			const data = (await response.json()) as OAuth2TokenResponse;

			return {
				token: data.access_token,
				expiresAt: new Date(Date.now() + data.expires_in * 1_000)
			};
		} catch (error) {
			throw new Error(`Failed to get token: ${(error as Error).stack}`);
		}
	}

	/**
	 * Instantiates ServicePrincipalCredential using environment variables.
	 * @returns ServicePrincipalCredential instance
	 */
	public static fromEnv() {
		return new ServicePrincipalCredential({
			clientId: process.env.AZURE_CLIENT_ID,
			clientSecret: process.env.AZURE_CLIENT_SECRET,
			tenantId: process.env.AZURE_TENANT_ID,
			federated: false
		});
	}
}

declare global {
	namespace NodeJS {
		interface ProcessEnv {
			AZURE_CLIENT_ID: string;
			AZURE_CLIENT_SECRET: string;
			AZURE_TENANT_ID: string;
		}
	}
}
