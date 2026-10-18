import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
} from "plaid";

export class PlaidConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlaidConfigError";
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new PlaidConfigError(
      `Missing ${name}. Copy .env.example to .env.local and fill in your Plaid sandbox credentials.`,
    );
  }
  return value;
}

let cachedClient: PlaidApi | null = null;

export function getPlaid(): PlaidApi {
  if (cachedClient) return cachedClient;

  const env = (process.env.PLAID_ENV ?? "sandbox") as keyof typeof PlaidEnvironments;
  const configuration = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": requireEnv("PLAID_CLIENT_ID"),
        "PLAID-SECRET": requireEnv("PLAID_SECRET"),
        "Plaid-Version": "2020-09-14",
      },
    },
  });
  cachedClient = new PlaidApi(configuration);
  return cachedClient;
}

export function plaidProducts(): Products[] {
  return (process.env.PLAID_PRODUCTS ?? "transactions")
    .split(",")
    .map((p) => p.trim() as Products);
}

export function plaidCountryCodes(): CountryCode[] {
  return (process.env.PLAID_COUNTRY_CODES ?? "US")
    .split(",")
    .map((c) => c.trim() as CountryCode);
}

export const PLAID_USER_ID = "local-user";

export function plaidRedirectUri(): string | undefined {
  const uri = process.env.PLAID_REDIRECT_URI?.trim();
  return uri ? uri : undefined;
}

export function isPlaidConfigured(): boolean {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}
