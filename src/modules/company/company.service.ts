import httpStatus from "http-status";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../global/apperror.js";
import type { CompanyUpdateInput, IUpsertCompany } from "./company.interface.js";

const buildCompanyUpdateData = (payload: IUpsertCompany): CompanyUpdateInput => {
    const data: CompanyUpdateInput = {};
    if (payload.name !== undefined) {
        data.name = payload.name;
    }
    if (payload.website !== undefined) {
        data.website = payload.website;
    }
    if (payload.logoUrl !== undefined) {
        data.logoUrl = payload.logoUrl;
    }
    return data;
};

const getCompanyForUserFromDB = async (userId: string) => {
    const membership = await prisma.companyMembership.findUnique({
        where: { userId },
        include: {
            company: true,
        },
    });

    if (!membership) {
        throw new AppError(httpStatus.NOT_FOUND, "No company found for this user");
    }
    return membership.company;
};

const upsertCompanyIntoDB = async (userId: string, payload: IUpsertCompany) => {
    const membership = await prisma.companyMembership.findUnique({
        where: { userId },
    });

    if (membership) {
        const company = await prisma.company.update({
            where: { id: membership.companyId },
            data: buildCompanyUpdateData(payload),
        });
        return company;
    }

    const company = await prisma.$transaction(async (tx) => {
        const created = await tx.company.create({
            data: {
                name: payload.name ?? "My Company",
                ...(payload.website !== undefined ? { website: payload.website } : {}),
                ...(payload.logoUrl !== undefined ? { logoUrl: payload.logoUrl } : {}),
            },
        });
        await tx.companyMembership.create({
            data: {
                userId,
                companyId: created.id,
            },
        });
        return created;
    });

    return company;
};

const getDashboardIntoDB = async (userId: string) => {
    const membership = await prisma.companyMembership.findUnique({
        where: { userId },
    });
    if (!membership) {
        throw new AppError(
            httpStatus.FORBIDDEN,
            "No company profile found. Create your company first.",
        );
    }
    const companyId = membership.companyId;

    const [company, assessments, invitations, attempts, average] = await Promise.all([
        prisma.company.findUnique({
            where: { id: companyId },
        }),
        prisma.assessment.findMany({
            where: { companyId, deletedAt: null },
            select: { id: true, status: true },
        }),
        prisma.invitation.findMany({
            where: { assessment: { companyId } },
            select: { id: true, status: true },
        }),
        prisma.attempt.findMany({
            where: { invitation: { assessment: { companyId } } },
            select: { id: true, status: true },
        }),
        prisma.attempt.aggregate({
            where: { status: "EVALUATED", invitation: { assessment: { companyId } } },
            _avg: { score: true },
        }),
    ]);

    const countByStatus = <T extends { status: string }>(rows: T[]) => {
        const result: Record<string, number> = {};
        for (const row of rows) {
            result[row.status] = (result[row.status] ?? 0) + 1;
        }
        return result;
    };

    return {
        company: {
            id: company?.id,
            name: company?.name,
            website: company?.website,
            logoUrl: company?.logoUrl,
            creditsRemaining: company?.creditsRemaining ?? 0,
            createdAt: company?.createdAt,
        },
        assessmentCount: assessments.length,
        assessmentsByStatus: countByStatus(assessments),
        invitationCount: invitations.length,
        invitationsByStatus: countByStatus(invitations),
        attemptCount: attempts.length,
        attemptsByStatus: countByStatus(attempts),
        averageScore: average._avg.score,
    };
};

export const companyService = {
    getCompanyForUserFromDB,
    upsertCompanyIntoDB,
    getDashboardIntoDB,
};