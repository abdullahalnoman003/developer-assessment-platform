import crypto from "node:crypto";
import httpStatus from "http-status";
import type { InvitationStatus, UserRole } from "../../../generated/prisma/client.js";
import { AppError } from "../../global/apperror.js";
import { prisma } from "../../lib/prisma.js";
import type { IInvitationListQuery, IInviteEmails, IUpdateInvitation } from "./invitation.interface.js";

const getCompanyIdFromUser = async (userId: string) => {
    const membership = await prisma.companyMembership.findUnique({
        where: { userId },
        select: { companyId: true },
    });
    if (!membership) {
        throw new AppError(
            httpStatus.FORBIDDEN,
            "No company profile found. Create your company first.",
        );
    }
    return membership.companyId;
};

const createInvitationsIntoDB = async (
    userId: string,
    assessmentId: string,
    payload: IInviteEmails,
) => {
    const companyId = await getCompanyIdFromUser(userId);

    const assessment = await prisma.assessment.findFirst({
        where: { id: assessmentId, companyId, deletedAt: null },
        select: { id: true, title: true },
    });
    if (!assessment) {
        throw new AppError(httpStatus.NOT_FOUND, "Assessment not found");
    }

    const emails = [...new Set(payload.candidateEmails.map((email) => email.toLowerCase()))];

    const candidates = await prisma.user.findMany({
        where: {
            email: { in: emails },
            role: "CANDIDATE",
        },
        select: { id: true, email: true },
    });
    const candidateByEmail = new Map(candidates.map((candidate) => [candidate.email, candidate.id]));

    const missingEmails = emails.filter((email) => !candidateByEmail.has(email));
    if (missingEmails.length > 0) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            `No candidate account found for: ${missingEmails.join(", ")}`,
        );
    }

    const candidateIds = emails.map((email) => candidateByEmail.get(email) as string);
    const existing = await prisma.invitation.findMany({
        where: {
            assessmentId,
            candidateId: { in: candidateIds },
            status: { in: ["PENDING", "ACCEPTED"] },
        },
        select: { candidateId: true },
    });
    if (existing.length > 0) {
        throw new AppError(
            httpStatus.CONFLICT,
            "One or more candidates are already invited to this assessment",
        );
    }

    const { invitations, createdCount } = await prisma.$transaction(async (tx) => {
        const created = await tx.invitation.createMany({
            data: candidateIds.map((candidateId) => ({
                assessmentId,
                candidateId,
                token: crypto.randomUUID(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            })),
        });
        const rows = await tx.invitation.findMany({
            where: {
                assessmentId,
                candidateId: { in: candidateIds },
            },
            include: {
                candidate: { select: { id: true, name: true, email: true } },
            },
        });
        return { invitations: rows, createdCount: created.count };
    });

    await prisma.auditLog.create({
        data: {
            userId,
            action: "INVITATIONS_SENT",
            entity: "Assessment",
            entityId: assessmentId,
            meta: { count: createdCount, candidateIds },
        },
    });

    return invitations;
};

const getMyInvitationsFromDB = async (userId: string, query: IInvitationListQuery) => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where = {
        candidateId: userId,
        ...(query.status ? { status: query.status as InvitationStatus } : {}),
    };

    const [items, total] = await Promise.all([
        prisma.invitation.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
                assessment: {
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        durationMins: true,
                        status: true,
                    },
                },
                attempt: {
                    select: {
                        id: true,
                        status: true,
                        score: true,
                        deadline: true,
                        resultReleased: true,
                    },
                },
            },
        }),
        prisma.invitation.count({ where }),
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

const updateInvitationIntoDB = async (
    userId: string,
    role: UserRole,
    invitationId: string,
    payload: IUpdateInvitation,
) => {
    const invitation = await prisma.invitation.findUnique({
        where: { id: invitationId },
        include: {
            assessment: { select: { id: true, companyId: true, title: true } },
        },
    });
    if (!invitation) {
        throw new AppError(httpStatus.NOT_FOUND, "Invitation not found");
    }

    if (invitation.status !== "PENDING") {
        throw new AppError(httpStatus.BAD_REQUEST, "This invitation is no longer pending");
    }

    if (invitation.expiresAt < new Date()) {
        await prisma.invitation.update({
            where: { id: invitationId },
            data: { status: "EXPIRED" },
        });
        throw new AppError(httpStatus.BAD_REQUEST, "This invitation has expired");
    }

    if (role === "CANDIDATE") {
        if (invitation.candidateId !== userId) {
            throw new AppError(httpStatus.FORBIDDEN, "You are not allowed to update this invitation");
        }
        const updated = await prisma.invitation.update({
            where: { id: invitationId },
            data: { status: payload.status },
        });
        return updated;
    }

    if (role === "RECRUITER") {
        const companyId = await getCompanyIdFromUser(userId);
        if (invitation.assessment.companyId !== companyId) {
            throw new AppError(httpStatus.FORBIDDEN, "You are not allowed to update this invitation");
        }
        const updated = await prisma.invitation.update({
            where: { id: invitationId },
            data: { status: "DECLINED" },
        });
        return updated;
    }

    throw new AppError(httpStatus.FORBIDDEN, "You are not allowed to update this invitation");
};

export const invitationService = {
    createInvitationsIntoDB,
    getMyInvitationsFromDB,
    updateInvitationIntoDB,
};