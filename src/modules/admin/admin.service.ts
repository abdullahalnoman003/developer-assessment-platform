import httpStatus from "http-status";
import { AppError } from "../../global/apperror.js";
import { prisma } from "../../lib/prisma.js";
import type { IAuditLogQuery, IUpdateUserStatus, IUsersQuery } from "./admin.interface.js";

const getUsersFromDB = async (query: IUsersQuery) => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const searchTerms = ((query.q ?? query.search) ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);

    const where = {
        ...(query.role ? { role: query.role } : {}),
        ...(query.status ? { status: query.status } : {}),
        deletedAt: null as Date | null,
        ...(searchTerms.length > 0
            ? {
                  OR: searchTerms.flatMap((term) => [
                      { name: { contains: term, mode: "insensitive" as const } },
                      { email: { contains: term, mode: "insensitive" as const } },
                  ]),
              }
            : {}),
    };

    const [items, total] = await Promise.all([
        prisma.user.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                status: true,
                authProvider: true,
                avatarUrl: true,
                createdAt: true,
                companyMembership: {
                    select: {
                        company: { select: { id: true, name: true } },
                    },
                },
                _count: {
                    select: {
                        invitations: true,
                        attempts: true,
                        auditLogs: true,
                    },
                },
            },
        }),
        prisma.user.count({ where }),
    ]);

    return {
        items,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

const updateUserStatusIntoDB = async (adminId: string, userId: string, payload: IUpdateUserStatus) => {
    const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, status: true },
    });

    if (!target) {
        throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }
    if (target.role === "ADMIN" && payload.status === "SUSPENDED") {
        throw new AppError(httpStatus.BAD_REQUEST, "Cannot suspend an admin user");
    }
    if (target.role === "ADMIN" && payload.deletedAt === "now") {
        throw new AppError(httpStatus.BAD_REQUEST, "Cannot delete an admin user");
    }

    const updated = await prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
            where: { id: userId },
            data: {
                ...(payload.status ? { status: payload.status } : {}),
                ...(payload.deletedAt === "now" ? { deletedAt: new Date() } : {}),
            },
            select: { id: true, name: true, email: true, role: true, status: true, deletedAt: true },
        });
        await tx.auditLog.create({
            data: {
                userId: adminId,
                action: payload.deletedAt === "now" ? "USER_DELETED" : "USER_STATUS_UPDATED",
                entity: "User",
                entityId: userId,
                meta: {
                    from: target.status,
                    to: payload.status ?? target.status,
                    ...(payload.deletedAt === "now" ? { deletedAt: new Date().toISOString() } : {}),
                },
            },
        });
        return user;
    });

    return updated;
};

const getStatsFromDB = async () => {
    const [
        totalUsers,
        totalRecruiters,
        totalCandidates,
        totalAdmins,
        totalCompanies,
        totalQuestions,
        totalAssessments,
        totalAttempts,
        totalPaidPayments,
        revenueAgg,
    ] = await Promise.all([
        prisma.user.count({ where: { deletedAt: null } }),
        prisma.user.count({ where: { deletedAt: null, role: "RECRUITER" } }),
        prisma.user.count({ where: { deletedAt: null, role: "CANDIDATE" } }),
        prisma.user.count({ where: { deletedAt: null, role: "ADMIN" } }),
        prisma.company.count(),
        prisma.question.count({ where: { deletedAt: null } }),
        prisma.assessment.count({ where: { deletedAt: null } }),
        prisma.attempt.count(),
        prisma.payment.count({ where: { status: "PAID" } }),
        prisma.payment.aggregate({
            where: { status: "PAID" },
            _sum: { amount: true },
        }),
    ]);

    return {
        users: {
            total: totalUsers,
            recruiters: totalRecruiters,
            candidates: totalCandidates,
            admins: totalAdmins,
        },
        companies: totalCompanies,
        questions: totalQuestions,
        assessments: totalAssessments,
        attempts: totalAttempts,
        payments: {
            paidCount: totalPaidPayments,
            totalRevenue: revenueAgg._sum.amount ?? 0,
        },
    };
};

const getAuditLogsFromDB = async (query: IAuditLogQuery) => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where = {
        ...(query.entity ? { entity: query.entity } : {}),
        ...(query.action ? { action: query.action } : {}),
    };

    const [items, total] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
                user: { select: { id: true, name: true, email: true } },
            },
        }),
        prisma.auditLog.count({ where }),
    ]);

    return {
        items,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

export const adminService = {
    getUsersFromDB,
    updateUserStatusIntoDB,
    getStatsFromDB,
    getAuditLogsFromDB,
};
