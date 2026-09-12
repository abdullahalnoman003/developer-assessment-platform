import bcrypt from "bcryptjs";
import type { UserRole } from "../../generated/prisma/client.js";
import { AuthProvider } from "../../generated/prisma/client.js";
import config from "../config/index.js";
import { prisma } from "../lib/prisma.js";

const accounts = [
    {
        role: "ADMIN" as UserRole,
        name: config.demo_admin_name ?? "Demo Admin",
        email: config.demo_admin_email ?? "admin@codearena.com",
        password: config.demo_admin_password ?? "admin1234",
    },
    {
        role: "RECRUITER" as UserRole,
        name: config.demo_recruiter_name ?? "Demo Recruiter",
        email: config.demo_recruiter_email ?? "recruiter@codearena.com",
        password: config.demo_recruiter_password ?? "recruiter123",
    },
    {
        role: "CANDIDATE" as UserRole,
        name: config.demo_candidate_name ?? "Demo Candidate",
        email: config.demo_candidate_email ?? "candidate@codearena.com",
        password: config.demo_candidate_password ?? "candidate123",
    },
];

const findAccount = (role: UserRole) => accounts.find((account) => account.role === role);

const ensureOnePerRole = async (role: UserRole) => {
    const existing = await prisma.user.findFirst({
        where: { role },
    });
    if (existing) {
        console.log(`Seed: demo ${role} already exists (${existing.email}), skipping.`);
        return;
    }

    const account = findAccount(role);
    if (!account) {
        return;
    }

    const passwordHash = await bcrypt.hash(account.password, Number(config.bcrypt_salt_rounds) || 10);

    await prisma.user.create({
        data: {
            name: account.name,
            email: account.email.toLowerCase(),
            passwordHash,
            role: account.role,
            authProvider: AuthProvider.LOCAL,
        },
        omit: { passwordHash: true },
    });

    console.log(`Seed: created demo ${role} account -> ${account.email}`);
};

export const seedDemoAccounts = async () => {
    for (const role of ["ADMIN", "RECRUITER", "CANDIDATE"] as const) {
        try {
            await ensureOnePerRole(role);
        } catch (error) {
            console.warn(`Seed: failed to create demo ${role} account:`, error);
        }
    }
};
