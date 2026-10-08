import {SecretManagerServiceClient} from '@google-cloud/secret-manager';

// Ensure the path to your key matches your Docker volume mount point
const client = new SecretManagerServiceClient({
    keyFilename: "./deployment-487315-74d4c09beec7.json"
});

class SecretManager {
    projectKey = "deployment-487315";
    B2_API_KEY;
    NEON_DATABASE_URL;

    async getSecret(secretName) {
        const name = `projects/${this.projectKey}/secrets/${secretName}/versions/latest`;
        try {
            const [version] = await client.accessSecretVersion({name});
            return version.payload.data.toString();
        } catch (error) {
            console.error(`Failed to fetch secret ${secretName}:`, error);
            throw error;
        }
    }

    async initialize() {
        console.log("Initializing Secrets...");
        this.B2_API_KEY = await this.getSecret("PHONEMOCKUP_B2_APP_KEY");
        this.NEON_DATABASE_URL = await this.getSecret("PHONEMOCKUP_NEON_DATABASE_URL");
        // The routes read these from process.env when they are imported,
        // which index.ts does only after this. A value the environment
        // already sets wins.
        process.env.DATABASE_URL ??= this.NEON_DATABASE_URL;
        process.env.B2_APP_KEY ??= this.B2_API_KEY;
        console.log("Secrets loaded into environment.");
    }
}

export const secretManager = new SecretManager();