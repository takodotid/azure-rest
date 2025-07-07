# @takodotid/azure-rest

Minimal Azure REST client with Entra ID (formerly AAD) authentication. No external dependencies.

## 🚀 Features

- Authenticate to Azure REST APIs using Entra ID (AAD)
- Supports Azure CLI, Managed Identity, Service Principal, and Workload Identity credentials
- Zero external dependencies
- ESM & CommonJS support

## 📦 Installation

> **Requirement:** Node.js 20+ or any runtime with built-in `fetch` (e.g. Bun, Deno).

```sh
pnpm add @takodotid/azure-rest
# or
yarn add @takodotid/azure-rest
# or
npm install @takodotid/azure-rest
```

## 🛠️ Usage

Here's a quick example to get you started:

```ts
import { AzureClient, ChainedCredential } from "@takodotid/azure-rest";

const client = new AzureClient({
	baseUrl: "https://management.azure.com", // Target Azure Management REST API endpoint
	credential: {
        scope: "https://management.azure.com/.default",
        helper: new ChainedCredential(),
        // Optional: you can provide a custom token builder if needed
        // builder: (token) => { Authorization: `Bearer ${token}`; }
    }
});

// Example: Get a list of resource groups
const response = await client.get("/subscriptions/<my subscription id>/resourcegroups?api-version=2022-09-01");

// Get the JSON response data. Full fetch API.
console.log(await response.json());
```

> **Note:** Make sure your environment is authenticated (e.g., via Azure CLI, Managed Identity, or Service Principal).

## 🧩 Credential Types Supported

You can use any of these credential helpers (just pick one that fits your use case):

- **AzureCliCredential** – Uses the token from Azure CLI (`az login`). Great for local dev.
- **ManagedIdentityCredential** – For apps running on Azure VM, App Service, Container Apps, etc. No secrets required.
- **ServicePrincipalCredential** – Authenticates using client ID & secret/certificate. Common for CI/CD or automation.
- **WorkloadIdentityCredential** – For OIDC/OpenID Connect scenarios, e.g., GitHub Actions to Azure and Azure Kubernetes Service (AKS).
- **ChainedCredential** – (Recommended) Automatically picks the most available one, in this order: Workload Identity → Managed Identity → Service Principal → Azure CLI.

> **Recommended:** Just use `ChainedCredential` unless you have a strong reason to pick something else. It’ll do the right thing in most environments.

## 📚 API

You can explore all available methods and options via JSDoc and TypeScript typings, no need to memorize anything. Just let your editor guide you!

## 🤝 Contributing
Pull requests are welcome! For major changes, please open an issue first to discuss what you want to change.

## 📄 License
MIT © PT Hobimu Jadi Cuan (Tako)

---

Made with ❤️ by Tako Devs.
