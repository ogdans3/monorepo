import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import compression from "compression";
import cookieParser from 'cookie-parser';
import {secretManager} from "./secret-manager.js";
import {config, checkConfig} from "./config.js";
import {errorHandler} from "./middleware/errorHandler.js";

const app = express();

async function bootstrap() {
    try {
        // 1. Initialize Secret Manager FIRST
        await secretManager.initialize();
        console.log("🔐 Secrets loaded and environment variables set.");
        const {errors, warnings} = checkConfig();
        for (const warning of warnings) console.warn(`⚠️ ${warning}`);
        if (errors.length) throw new Error(`Missing configuration: ${errors.join("; ")}`);

        // 2. Dynamically import routes AFTER secrets are ready
        // This prevents routes from using undefined config values
        const {default: api} = await import("./routes/api.js");
        const {logger} = await import("./logger.js");

        // 3. Configure Express Settings
        if (config.trustProxy) {
            app.enable("trust proxy");
        }

        // 4. Global Middleware
        app.use(helmet());
        app.use(cors({origin: config.corsOrigin, credentials: true}));
        app.use(compression());
        app.use(morgan(':date[clf] :method :url :status :res[content-length] - :response-time ms'));

        app.use(express.json({limit: "2mb"}));
        app.use(express.urlencoded({extended: false}));
        app.use(cookieParser());

        // 5. Use the dynamically imported API routes
        app.use("/api", api);

        // 6. Error Handling
        app.use((_req, res) => {
            res.status(404).json({error: "Not Found"});
        });
        app.use(errorHandler);

        // 7. Start Server
        const server = app.listen(config.port, () => {
            logger.info("🚀 Server started", {
                port: config.port,
                env: config.nodeEnv,
            });
        });

        // A redeploy sends SIGTERM. Finish the saves and uploads in flight
        // before exiting, but give up after 30 seconds.
        const shutdown = () => {
            server.closeIdleConnections();
            const timeout = setTimeout(() => server.closeAllConnections(), 30_000);
            timeout.unref();
            server.close(() => process.exit(0));
        };
        process.once("SIGTERM", shutdown);
        process.once("SIGINT", shutdown);

    } catch (error) {
        console.error("❌ Fatal error during bootstrap:", error);
        process.exit(1);
    }
}

bootstrap();