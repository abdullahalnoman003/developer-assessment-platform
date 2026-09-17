import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";

const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({
    connectionString,
    connectionTimeoutMillis: 5000,
});
const prisma = new PrismaClient({ adapter });

export { prisma };
