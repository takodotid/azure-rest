/**
 * Represents an Azure access token and its expiration.
 */
export type Credential = { accessToken: string; clientId?: string; expiresAt: Date; tokenType: string };

/**
 * Abstract credential class for acquiring Azure tokens.
 * Implement this to provide custom authentication logic.
 */
export abstract class AzureCredential {
	/**
	 * Gets an Azure access token for the given scope.
	 * @param scope The resource or scope for which the token is requested
	 * @returns A promise resolving to an AzureToken
	 */
	public abstract getToken(scope: string): Promise<Credential>;
}
