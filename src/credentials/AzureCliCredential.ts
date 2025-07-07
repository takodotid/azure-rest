import { execFile } from "node:child_process";
import process from "node:process";
import type { AzureCredential } from "./AzureCredential.js";

/**
 * The raw response returned by Azure CLI when requesting an access token.
 *
 * @property accessToken - The access token string
 * @property expiresOn - Expiry date in RFC3339 format (legacy)
 * @property expires_on - Expiry as seconds since epoch (preferred)
 * @property subscription - (Optional) Subscription ID, may not be present
 * @property tenant - Tenant ID
 * @property tokenType - Token type (usually 'Bearer')
 */
export type CLITokenResponse = {
	accessToken: string;
	expiresOn: string;
	expires_on: string;
	subscription?: string;
	tenant: string;
	tokenType: string;
};

/**
 * Options for AzureCliCredential.
 *
 * @property tenantId - (Optional) The Azure tenant ID to use for authentication. If not provided, will use the current Azure CLI context.
 */
export type AzureCLICredentialOptions = {
	tenantId?: string;
};

/**
 * AzureCliCredential authenticates using the Azure CLI (`az`).
 *
 * - If `tenantId` is provided, uses it for token requests.
 * - If not, will try `AZURE_TENANT_ID` env var, then fall back to the current Azure CLI context.
 *
 * Throws clear errors if the CLI is not installed or not logged in.
 */
export class AzureCliCredential implements AzureCredential {
	public constructor(public options: AzureCLICredentialOptions) {}

	/**
	 * Instantiates AzureCliCredential using the AZURE_TENANT_ID environment variable (if set),
	 * or falls back to the current Azure CLI context.
	 * @returns AzureCliCredential instance
	 */
	public static fromEnv(): AzureCliCredential {
		const tenantId = process.env.AZURE_TENANT_ID;
		return new AzureCliCredential(tenantId ? { tenantId } : {});
	}

	/**
	 * Gets an Azure access token using the Azure CLI.
	 * @param scope The resource scope for the token (e.g. 'https://management.azure.com/.default')
	 * @returns An object with accessToken, expiresAt, and tokenType
	 * @throws If CLI is not installed or not logged in
	 */
	public async getToken(scope: string): Promise<{ accessToken: string; expiresAt: Date; tokenType: string }> {
		try {
			const tenantId = this.options.tenantId ?? (await AzureCliCredential.getCurrentTenantId());
			const result = await this.getCliToken(scope, tenantId);
			return this.parseRawOutput(result.stdout);
		} catch (error) {
			throw new Error(`Failed to get token: ${(error as Error).message}`);
		}
	}

	/**
	 * Runs the Azure CLI to get an access token for the given scope and tenant.
	 * @param scope The resource scope
	 * @param tenantId The Azure tenant ID
	 * @returns Promise resolving to CLI stdout and stderr
	 * @private
	 */
	private async getCliToken(scope: string, tenantId: string): Promise<{ stderr: string; stdout: string }> {
		return new Promise((resolve, reject) => {
			try {
				execFile(
					"az",
					["account", "get-access-token", "--output", "json", "--resource", scope.replace(".default", ""), "--tenant", tenantId],
					{ cwd: process.cwd(), shell: true, timeout: 30_000 },
					(error, stdout, stderr) => {
						const { isLoginError, isNotInstallError } = AzureCliCredential.parseCliLoginError(stderr);
						if (isNotInstallError) {
							reject(new Error("Azure CLI not found. Please install"));
							return;
						}
						if (isLoginError) {
							reject(new Error("Please login to Azure CLI"));
							return;
						}
						if (error) {
							reject(new Error(`Failed to get token: ${error.message}`));
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
	 * Gets the current tenant ID from Azure CLI context.
	 * @returns Promise resolving to the current tenant ID string
	 * @throws If CLI is not installed or not logged in
	 */
	private static async getCurrentTenantId(): Promise<string> {
		return new Promise((resolve, reject) => {
			execFile("az", ["account", "show", "--query", "tenantId", "--output", "tsv"], { cwd: process.cwd(), shell: true, timeout: 10_000 }, (error, stdout, stderr) => {
				const { isLoginError, isNotInstallError } = AzureCliCredential.parseCliLoginError(stderr);
				if (isNotInstallError) {
					reject(new Error("Azure CLI not found. Please install"));
					return;
				}
				if (isLoginError) {
					reject(new Error("Please login to Azure CLI"));
					return;
				}
				if (error) {
					reject(new Error(`Failed to detect tenantId from Azure CLI context: ${stderr}`));
					return;
				}
				const tenantId = stdout.trim();
				if (!tenantId) {
					reject(new Error("Could not detect tenantId from Azure CLI context."));
					return;
				}
				resolve(tenantId);
			});
		});
	}

	/**
	 * Parses the raw CLI output and returns a token + expiry object.
	 * @param output The stdout from Azure CLI
	 * @returns An object with accessToken, expiresAt, and tokenType
	 * @private
	 */
	private parseRawOutput(output: string): { accessToken: string; expiresAt: Date; tokenType: string } {
		const response = JSON.parse(output) as CLITokenResponse;
		const token = response.accessToken;
		const expiresOnTimestamp = Number.parseInt(response.expires_on, 10) * 1_000;
		if (!Number.isNaN(expiresOnTimestamp)) {
			return {
				accessToken: token,
				expiresAt: new Date(expiresOnTimestamp),
				tokenType: response.tokenType
			};
		}
		return {
			accessToken: token,
			expiresAt: new Date(response.expiresOn),
			tokenType: response.tokenType
		};
	}

	/**
	 * Checks stderr for common Azure CLI login errors.
	 * @param stderr The stderr string from CLI
	 * @returns Object with isLoginError and isNotInstallError booleans
	 * @private
	 */
	private static parseCliLoginError(stderr: string): { isLoginError: boolean; isNotInstallError: boolean } {
		const specificScope = stderr.match("(.*)az login --scope(.*)");
		const isLoginError = stderr.match("(.*)az login(.*)") && !specificScope;
		const isNotInstallError = stderr.match("az:(.*)not found") ?? stderr.startsWith("'az' is not recognized");
		return {
			isLoginError: Boolean(isLoginError),
			isNotInstallError: Boolean(isNotInstallError)
		};
	}
}

declare global {
	namespace NodeJS {
		interface ProcessEnv {
			AZURE_TENANT_ID: string;
		}
	}
}
