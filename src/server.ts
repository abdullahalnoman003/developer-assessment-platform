import "dotenv/config";
import app from "./app.js";
import config from "./config/index.js";
import { prisma } from "./lib/prisma.js";
import { seedDemoAccounts } from "./seed/index.js";

const PORT = Number(config.port) || 5000;

export default app;

// Global error handlers to catch crashes
process.on("uncaughtException", (error) => {
    console.error("UNCAUGHT EXCEPTION:", error);
    process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("UNHANDLED REJECTION at:", promise, "reason:", reason);
    process.exit(1);
});

async function main() {
    try {
        await prisma.$connect();
        console.log("Connected to the database successfully.");
        try {
            await seedDemoAccounts();
            console.log("Demo accounts seeded successfully.");
        } catch (seedError) {
            console.warn("Seeding skipped or failed:", seedError);
        }
        const server = app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });

        // Graceful shutdown
        const shutdown = async () => {
            console.log("Shutting down gracefully...");
            server.close(async () => {
                await prisma.$disconnect();
                process.exit(0);
            });
        };
        process.on("SIGTERM", shutdown);
        process.on("SIGINT", shutdown);
    } catch (error) {
        console.error("Error starting the server:", error);
        await prisma.$disconnect();
        process.exit(1);
    }
}

if (!process.env.VERCEL) {
    void main();
}
