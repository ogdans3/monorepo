import {SecretManagerServiceClient} from '@google-cloud/secret-manager';

// The secrets this API pulls from Google Secret Manager, and the variable each
// one fills. A variable the environment already sets wins, and its secret is
// not fetched at all, so the API also starts where the keyfile isn't mounted
// (development, CI, another host).
const SECRETS = [
    {secret: "PHONEMOCKUP_B2_APP_KEY", env: "B2_APP_KEY"},
    {secret: "PHONEMOCKUP_NEON_DATABASE_URL", env: "DATABASE_URL"},
] as const;

class SecretManager {
    projectKey = "deployment-487315";
    private client?: SecretManagerServiceClient;

    async getSecret(secretName: string) {
        // Ensure the path to your key matches your Docker volume mount point
        this.client ??= new SecretManagerServiceClient({
            keyFilename: "./deployment-487315-74d4c09beec7.json"
        });
        const name = `projects/${this.projectKey}/secrets/${secretName}/versions/latest`;
        try {
            const [version] = await this.client.accessSecretVersion({name});
            if (!version.payload?.data) throw new Error(`Secret ${secretName} is empty`);
            return version.payload.data.toString();
        } catch (error) {
            console.error(`Failed to fetch secret ${secretName}:`, error);
            throw error;
        }
    }

    async initialize() {
        // The routes read these from process.env when they are imported,
        // which index.ts does only after this.
        const missing = SECRETS.filter(({env}) => !process.env[env]);
        if (missing.length === 0) {
            console.log("Secrets already set in the environment.");
            return;
        }
        console.log("Initializing Secrets...");
        for (const {secret, env} of missing) {
            process.env[env] = await this.getSecret(secret);
        }
        console.log("Secrets loaded into environment.");
    }
}

export const secretManager = new SecretManager();
