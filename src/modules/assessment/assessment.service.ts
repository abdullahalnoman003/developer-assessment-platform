import httpStatus from "http-status";
import type { AssessmentStatus, Prisma } from "../../../generated/prisma/client.js";
import { AppError } from "../../global/apperror.js";
import { prisma } from "../../lib/prisma.js";
import type { IAssessmentListQuery, ICreateAssessment, IUpdateAssessment } from "./assessment.interface.js";

const getCompanyIdFromUser = async (userId: string) => {
    const membership = await prisma.companyMembership.findUnique({
        where: { userId },
        select: { companyId: true },
    });
    if (!membership) {
        throw new AppError(httpStatus.FORBIDDEN, "No company profile found. Create your company first.");
    }
    return membership.companyId;
};

const createAssessmentIntoDB = async (userId: string, payload: ICreateAssessment) => {
    const companyId = await getCompanyIdFromUser(userId);

    const assessment = await prisma.assessment.create({
        data: {
            companyId,
            title: payload.title,
            durationMins: payload.durationMins,
            ...(payload.description !== undefined ? { description: payload.description } : {}),
            ...(payload.passScore !== undefined ? { passScore: payload.passScore } : {}),
        },
    });

    return assessment;
};

const getAssessmentsFromDB = async (userId: string, query: IAssessmentListQuery) => {
    const companyId = await getCompanyIdFromUser(userId);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy === "title" ? "title" : "createdAt";
    const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

    const where: Prisma.AssessmentWhereInput = {
        companyId,
        deletedAt: null,
        ...(query.status ? { status: query.status as AssessmentStatus } : {}),
    };

    const [items, total] = await Promise.all([
        prisma.assessment.findMany({
            where,
            skip,
            take: limit,
            orderBy: { [sortBy]: sortOrder },
            include: {
                _count: { select: { questions: true, invitations: true } },
            },
        }),
        prisma.assessment.count({ where }),
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

const getAssessmentByIdFromDB = async (userId: string, assessmentId: string) => {
    const companyId = await getCompanyIdFromUser(userId);

    const assessment = await prisma.assessment.findFirst({
        where: { id: assessmentId, companyId, deletedAt: null },
        include: {
            questions: {
                include: { question: true },
                orderBy: { order: "asc" },
            },
            _count: { select: { invitations: true } },
        },
    });

    if (!assessment) {
        throw new AppError(httpStatus.NOT_FOUND, "Assessment not found");
    }

    const [invitations, attempts] = await Promise.all([
        prisma.invitation.findMany({
            where: { assessmentId },
            select: { status: true },
        }),
        prisma.attempt.findMany({
            where: { invitation: { assessmentId } },
            select: { status: true, score: true },
        }),
    ]);

    const countByStatus = <T extends { status: string }>(rows: T[]) => {
        const result: Record<string, number> = {};
        for (const row of rows) {
            result[row.status] = (result[row.status] ?? 0) + 1;
        }
        return result;
    };

    const evaluatedScores = attempts.filter((attempt) => attempt.status === "EVALUATED" && attempt.score !== null);
    const averageScore =
        evaluatedScores.length > 0
            ? evaluatedScores.reduce((sum, attempt) => sum + (attempt.score ?? 0), 0) / evaluatedScores.length
            : null;

    return {
        ...assessment,
        stats: {
            invitationCount: invitations.length,
            invitationsByStatus: countByStatus(invitations),
            attemptCount: attempts.length,
            attemptsByStatus: countByStatus(attempts),
            averageScore,
        },
    };
};

const updateAssessmentIntoDB = async (userId: string, assessmentId: string, payload: IUpdateAssessment) => {
    const companyId = await getCompanyIdFromUser(userId);

    const assessment = await prisma.assessment.findFirst({
        where: { id: assessmentId, companyId, deletedAt: null },
        include: {
            _count: { select: { questions: true, invitations: true } },
        },
    });
    if (!assessment) {
        throw new AppError(httpStatus.NOT_FOUND, "Assessment not found");
    }

    if (payload.deletedAt === "now") {
        const deleted = await prisma.assessment.update({
            where: { id: assessmentId },
            data: { deletedAt: new Date() },
        });
        return deleted;
    }

    if (payload.status) {
        const allowedTransitions: Record<string, string[]> = {
            DRAFT: ["PUBLISHED"],
            PUBLISHED: ["CLOSED"],
            CLOSED: ["ARCHIVED"],
        };
        const allowed = allowedTransitions[assessment.status];
        if (!allowed?.includes(payload.status)) {
            throw new AppError(
                httpStatus.BAD_REQUEST,
                `Cannot transition assessment from ${assessment.status} to ${payload.status}`,
            );
        }
        if (payload.status === "PUBLISHED" && assessment._count.questions === 0) {
            throw new AppError(httpStatus.BAD_REQUEST, "Add at least one question before publishing");
        }

        const updated = await prisma.assessment.update({
            where: { id: assessmentId },
            data: { status: payload.status },
        });

        await prisma.auditLog.create({
            data: {
                userId,
                action: "ASSESSMENT_STATUS_CHANGE",
                entity: "Assessment",
                entityId: assessmentId,
                meta: { from: assessment.status, to: payload.status },
            },
        });

        return updated;
    }

    if (payload.questionIds) {
        if (assessment.status !== "DRAFT") {
            throw new AppError(httpStatus.BAD_REQUEST, "Questions can only be modified on draft assessments");
        }
        const questionIds = payload.questionIds;
        const uniqueCount = new Set(questionIds).size;
        const count = await prisma.question.count({
            where: { id: { in: questionIds }, companyId, deletedAt: null },
        });
        if (count !== uniqueCount) {
            throw new AppError(
                httpStatus.BAD_REQUEST,
                "One or more questions are invalid or not owned by your company",
            );
        }

        await prisma.$transaction(async (tx) => {
            await tx.assessmentQuestion.deleteMany({
                where: { assessmentId },
            });
            if (questionIds.length > 0) {
                await tx.assessmentQuestion.createMany({
                    data: questionIds.map((questionId, index) => ({
                        assessmentId,
                        questionId,
                        points: 1,
                        order: index,
                    })),
                });
            }
        });

        const updated = await prisma.assessment.findUnique({
            where: { id: assessmentId },
            include: {
                questions: {
                    include: { question: true },
                    orderBy: { order: "asc" },
                },
            },
        });
        return updated;
    }

    if (assessment.status !== "DRAFT") {
        throw new AppError(httpStatus.BAD_REQUEST, "Only draft assessments can be edited");
    }

    const data: Prisma.AssessmentUpdateInput = {};
    if (payload.title !== undefined) {
        data.title = payload.title;
    }
    if (payload.description !== undefined) {
        data.description = payload.description;
    }
    if (payload.durationMins !== undefined) {
        data.durationMins = payload.durationMins;
    }
    if (payload.passScore !== undefined) {
        data.passScore = payload.passScore;
    }

    const updated = await prisma.assessment.update({
        where: { id: assessmentId },
        data,
    });

    return updated;
};

export const assessmentService = {
    createAssessmentIntoDB,
    getAssessmentsFromDB,
    getAssessmentByIdFromDB,
    updateAssessmentIntoDB,
};
