import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    AssessmentStatus,
    AttemptStatus,
    AuthProvider,
    Difficulty,
    InvitationStatus,
    PaymentProvider,
    PaymentStatus,
    Prisma,
    QuestionType,
    UserRole,
} from "../../generated/prisma/client.js";
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

const QUESTIONS = [
    {
        type: QuestionType.MCQ,
        difficulty: Difficulty.EASY,
        title: "Which HTTP method is idempotent?",
        body: "Choose the correct option.",
        options: ["GET", "POST", "PUT", "DELETE"],
        correctAnswer: "PUT",
        tags: ["http", "rest"],
    },
    {
        type: QuestionType.MCQ,
        difficulty: Difficulty.MEDIUM,
        title: "What does ACID stand for in databases?",
        body: "Choose the correct option.",
        options: [
            "Atomicity, Consistency, Isolation, Durability",
            "Accuracy, Consistency, Isolation, Durability",
            "Atomicity, Control, Integrity, Durability",
            "Atomicity, Consistency, Integrity, Deployment",
        ],
        correctAnswer: "Atomicity, Consistency, Isolation, Durability",
        tags: ["database", "transactions"],
    },
    {
        type: QuestionType.WRITTEN,
        difficulty: Difficulty.MEDIUM,
        title: "Explain REST in 3-5 sentences.",
        body: "Write 3-5 sentences describing REST and its main constraints.",
        tags: ["architecture"],
    },
    {
        type: QuestionType.CODING,
        difficulty: Difficulty.HARD,
        title: "Two Sum",
        body: "Write a function that returns the indices of two numbers in an array that add up to a target.",
        tags: ["algorithms", "typescript"],
    },
    {
        type: QuestionType.WRITTEN,
        difficulty: Difficulty.MEDIUM,
        title: "Securing and deploying a Node.js API",
        body: "Explain how you would secure and deploy a production Node.js/Express API.",
        tags: ["deployment", "security"],
    },
];

const ensureCandidateProfile = async (candidateId: string) => {
    const existing = await prisma.user.findUnique({
        where: { id: candidateId },
        select: { avatarUrl: true, phone: true, bio: true, skills: true, resumeUrl: true, githubUrl: true },
    });
    if (!existing) {
        return;
    }
    const profile = {
        avatarUrl: existing.avatarUrl ?? "https://avatars.githubusercontent.com/u/example",
        phone: existing.phone ?? "+1 555 010 0199",
        bio: existing.bio ?? "Full-stack developer interested in backend engineering.",
        skills: existing.skills.length > 0 ? existing.skills : ["TypeScript", "Node.js", "PostgreSQL"],
        resumeUrl: existing.resumeUrl ?? "https://resume.io/demo-candidate",
        githubUrl: existing.githubUrl ?? "https://github.com/demo-candidate",
    };
    if (
        existing.avatarUrl === profile.avatarUrl &&
        existing.phone === profile.phone &&
        existing.bio === profile.bio &&
        existing.skills.length === profile.skills.length &&
        existing.resumeUrl === profile.resumeUrl &&
        existing.githubUrl === profile.githubUrl
    ) {
        return;
    }
    await prisma.user.update({
        where: { id: candidateId },
        data: profile,
    });
    console.log("Seed: filled demo candidate profile.");
};

const ensureCompanyForRecruiter = async (recruiterId: string) => {
    const membership = await prisma.companyMembership.findUnique({
        where: { userId: recruiterId },
        include: { company: true },
    });
    if (membership) {
        return membership.company;
    }

    return prisma.$transaction(async (tx) => {
        const company = await tx.company.create({
            data: { name: "Acme Cyberdyne", website: "https://acme.io" },
        });
        await tx.companyMembership.create({ data: { userId: recruiterId, companyId: company.id } });
        return company;
    });
};

const addDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

const seeds = {
    assessmentATitle: "Backend Engineer Test",
    assessmentBTitle: "Node.js Take-Home",
    providerRef: "seed_starter_plan",
};

const ensureAuditLog = async (
    tx: Prisma.TransactionClient,
    data: { userId: string; action: string; entity: string; entityId: string; meta?: object },
) => {
    const existing = await tx.auditLog.findFirst({
        where: { action: data.action, entity: data.entity, entityId: data.entityId },
    });
    if (!existing) {
        await tx.auditLog.create({ data });
    }
};

export const seedDemoData = async () => {
    const recruiter = await prisma.user.findFirst({ where: { role: UserRole.RECRUITER } });
    const candidate = await prisma.user.findFirst({ where: { role: UserRole.CANDIDATE } });
    if (!recruiter || !candidate) {
        console.warn("Seed: demo recruiter/candidate not found, skipping demo data.");
        return;
    }

    await ensureCandidateProfile(candidate.id);

    const company = await ensureCompanyForRecruiter(recruiter.id);

    const existingAssessment = await prisma.assessment.findFirst({
        where: { companyId: company.id, title: seeds.assessmentATitle },
    });
    if (existingAssessment) {
        console.log("Seed: demo assessment already exists, skipping demo data.");
        return;
    }

    try {
        const summary = await prisma.$transaction(async (tx) => {
            const questions: Array<{ id: string }> = [];
            for (const q of QUESTIONS) {
                const created = await tx.question.create({
                    data: { companyId: company.id, ...q },
                });
                questions.push(created);
            }
            const [q1, q2, q3, q4, q5] = questions;
            if (!q1 || !q2 || !q3 || !q4 || !q5) {
                throw new Error("Seed: failed to create all demo questions.");
            }

            const assessmentA = await tx.assessment.create({
                data: {
                    companyId: company.id,
                    title: seeds.assessmentATitle,
                    description: "60 min general test",
                    status: AssessmentStatus.PUBLISHED,
                    durationMins: 60,
                    passScore: 70,
                },
            });
            await tx.assessmentQuestion.createMany({
                data: [
                    { assessmentId: assessmentA.id, questionId: q1.id, points: 1, order: 0 },
                    { assessmentId: assessmentA.id, questionId: q2.id, points: 1, order: 1 },
                    { assessmentId: assessmentA.id, questionId: q3.id, points: 1, order: 2 },
                ],
            });

            const invitationA = await tx.invitation.create({
                data: {
                    assessmentId: assessmentA.id,
                    candidateId: candidate.id,
                    status: InvitationStatus.ACCEPTED,
                    token: randomUUID(),
                    expiresAt: addDays(7),
                },
            });

            const startedAt = new Date(Date.now() - 120 * 60 * 1000);
            const deadline = new Date(startedAt.getTime() + 60 * 60 * 1000);
            const submittedAt = new Date(startedAt.getTime() + 50 * 60 * 1000);
            const attemptA = await tx.attempt.create({
                data: {
                    invitationId: invitationA.id,
                    candidateId: candidate.id,
                    status: AttemptStatus.SUBMITTED,
                    startedAt,
                    submittedAt,
                    deadline,
                    score: 1,
                    maxScore: 3,
                    resultReleased: false,
                },
            });
            await tx.answer.createMany({
                data: [
                    {
                        attemptId: attemptA.id,
                        questionId: q1.id,
                        response: "PUT",
                        isCorrect: true,
                        pointsAwarded: 1,
                    },
                    {
                        attemptId: attemptA.id,
                        questionId: q2.id,
                        response: "Atomicity, Control, Integrity, Durability",
                        isCorrect: false,
                        pointsAwarded: 0,
                    },
                    {
                        attemptId: attemptA.id,
                        questionId: q3.id,
                        response: "REST is an architectural style for distributed systems. It relies on stateless HTTP and a uniform interface.",
                        isCorrect: null,
                        pointsAwarded: null,
                    },
                ],
            });

            const assessmentB = await tx.assessment.create({
                data: {
                    companyId: company.id,
                    title: seeds.assessmentBTitle,
                    description: "45 min take-home challenge",
                    status: AssessmentStatus.PUBLISHED,
                    durationMins: 45,
                    passScore: 60,
                },
            });
            await tx.assessmentQuestion.createMany({
                data: [
                    { assessmentId: assessmentB.id, questionId: q3.id, points: 1, order: 0 },
                    { assessmentId: assessmentB.id, questionId: q4.id, points: 2, order: 1 },
                    { assessmentId: assessmentB.id, questionId: q5.id, points: 2, order: 2 },
                ],
            });
            await tx.invitation.create({
                data: {
                    assessmentId: assessmentB.id,
                    candidateId: candidate.id,
                    status: InvitationStatus.PENDING,
                    token: randomUUID(),
                    expiresAt: addDays(7),
                },
            });

            const existingPayment = await tx.payment.findUnique({
                where: { providerRef: seeds.providerRef },
            });
            let payment = existingPayment;
            if (!payment) {
                payment = await tx.payment.create({
                    data: {
                        companyId: company.id,
                        provider: PaymentProvider.STRIPE,
                        amount: 20,
                        status: PaymentStatus.PAID,
                        providerRef: seeds.providerRef,
                        creditsGranted: 25,
                    },
                });
                await tx.company.update({
                    where: { id: company.id },
                    data: { creditsRemaining: { increment: 25 } },
                });
            }

            const recruiterId = recruiter.id;
            await ensureAuditLog(tx, {
                userId: recruiterId,
                action: "ASSESSMENT_STATUS_CHANGE",
                entity: "Assessment",
                entityId: assessmentA.id,
                meta: { from: "DRAFT", to: "PUBLISHED" },
            });
            await ensureAuditLog(tx, {
                userId: recruiterId,
                action: "INVITATIONS_SENT",
                entity: "Invitation",
                entityId: invitationA.id,
            });
            await ensureAuditLog(tx, {
                userId: recruiterId,
                action: "PAYMENT_CONFIRMED",
                entity: "Payment",
                entityId: payment.id,
            });

            return {
                assessmentA: assessmentA.id,
                assessmentB: assessmentB.id,
                invitationA: invitationA.id,
                attemptA: attemptA.id,
            };
        });

        console.log("Seed: created demo company, questions, assessments, invitations and attempt.", summary);
    } catch (error) {
        console.warn("Seed: failed to create demo data:", error);
    }
};

export const seedAll = async () => {
    await seedDemoAccounts();
    await seedDemoData();
};

const isDirectRun = () => {
    const entry = process.argv[1];
    if (!entry) {
        return false;
    }
    return path.resolve(fileURLToPath(import.meta.url)) === path.resolve(entry);
};

if (isDirectRun()) {
    seedAll()
        .catch((error) => {
            console.error("Seed failed:", error);
            process.exitCode = 1;
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}