import { execFile } from "node:child_process";
import process from "node:process";
import type { AzureCredential } from "./AzureCredential.js";

/**
 * The raw response returned by Azure CLI when requesting an access token.
 *
 * @property accessToken - The access token string
 * @property expiresOn - Expiry date in RFC3339 format (legacy)
 * @property expires_on - Expiry as seconds since epoch (preferred)
 * @property tenant - Tenant ID
 * @property tokenType - Token type (usually 'Bearer')
 */
export type CLITokenResponse = {
	accessToken: string;
	expiresOn: string; // RFC3339
	expires_on: string;
	tenant: string;
	tokenType: string;
};

/**
 * Options for AzureCliCredential.
 *
 * @property tenantId - The Azure tenant ID to use for authentication
 */
export type AzureCLICredentialOptions = {
	tenantId: string;
};

export class AzureCliCredential implements AzureCredential {
	public constructor(public options: AzureCLICredentialOptions) {}

	/**
	 * Gets an Azure access token using the Azure CLI.
	 * @param scope The resource scope for the token
	 * @returns An object with token and expiresAt
	 * @throws If CLI is not installed or not logged in
	 */
	public async getToken(scope: string) {
		try {
			const result = await this.getCliToken(scope);

			const specificScope = result.stderr.match("(.*)az login --scope(.*)");
			const isLoginError = result.stderr.match("(.*)az login(.*)") && !specificScope;
			const isNotInstallError = result.stderr.match("az:(.*)not found") ?? result.stderr.startsWith("'az' is not recognized");

			if (isNotInstallError) {
				throw new Error("Azure CLI not found. Please install");
			}
			if (isLoginError) {
				throw new Error("Please login to Azure CLI");
			}

			return this.parseRawOutput(result.stdout);
		} catch (error) {
			throw new Error(`Failed to get token: ${(error as Error).stack}`);
		}
	}

	/**
	 * Runs the Azure CLI to get an access token for the given scope.
	 * @param scope The resource scope
	 * @returns Promise resolving to CLI stdout and stderr
	 * @private
	 */
	private async getCliToken(scope: string) {
		return new Promise<{ stderr: string; stdout: string }>((resolve, reject) => {
			try {
				execFile(
					"az",
					["account", "get-access-token", "--output", "json", "--resource", scope.replace(".default", ""), "--tenant", this.options.tenantId],
					{ cwd: process.cwd(), shell: true, timeout: 30_000 },
					// eslint-disable-next-line promise/prefer-await-to-callbacks
					(error, stdout, stderr) => {
						if (error) {
							reject(new Error(`Failed to get token: ${error.stack}`));
							return;
						}

						resolve({ stdout, stderr });
					}
				);
			} catch (error) {
				reject(error as Error);
			}
		});
	}

	/**
	 * Parses the raw CLI output and returns a token + expiry object.
	 * @param output The stdout from Azure CLI
	 * @returns An object with token and expiresAt
	 * @private
	 */
	private parseRawOutput(output: string) {
		const response = JSON.parse(output) as CLITokenResponse;
		const token = response.accessToken;

		// if available, expires_on will be a number representing seconds since epoch.
		// ensure it's a number or NaN
		const expiresOnTimestamp = Number.parseInt(response.expires_on, 10) * 1_000;
		if (!Number.isNaN(expiresOnTimestamp)) {
			return {
				token,
				expiresAt: new Date(expiresOnTimestamp)
			};
		}

		// fallback to the older expiresOn - an RFC3339 date string
		return {
			token,
			expiresAt: new Date(response.expiresOn)
		};
	}

	/**
	 * Instantiates AzureCliCredential using the AZURE_TENANT_ID environment variable.
	 * @returns AzureCliCredential instance
	 */
	public static fromEnv() {
		return new AzureCliCredential({ tenantId: process.env.AZURE_TENANT_ID });
	}
}

declare global {
	namespace NodeJS {
		// eslint-disable-next-line typescript/consistent-type-definitions
		interface ProcessEnv {
			AZURE_TENANT_ID: string;
		}
	}
}
