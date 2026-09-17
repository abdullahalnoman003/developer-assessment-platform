import httpStatus from "http-status";
import type { Prisma, UserRole } from "../../../generated/prisma/client.js";
import { AppError } from "../../global/apperror.js";
import { prisma } from "../../lib/prisma.js";
import type { IEvaluateAttemptPayload, IResultsQuery, IUpdateAttemptPayload } from "./attempt.interface.js";

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

const expireIfStale = async (attemptId: string, status: string, deadline: Date | null) => {
    if (status === "IN_PROGRESS" && deadline && deadline.getTime() < Date.now()) {
        await prisma.attempt.update({
            where: { id: attemptId },
            data: { status: "EXPIRED" },
        });
        return true;
    }
    return false;
};

const autoGradeAndSubmit = async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], attemptId: string) => {
    const attempt = await tx.attempt.findUnique({
        where: { id: attemptId },
        include: {
            answers: true,
            invitation: {
                include: {
                    assessment: {
                        include: {
                            questions: {
                                include: { question: true },
                                orderBy: { order: "asc" },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!attempt) {
        throw new AppError(httpStatus.NOT_FOUND, "Attempt not found");
    }

    const assessment = attempt.invitation.assessment;
    let score = 0;
    let maxScore = 0;

    for (const assessmentQuestion of assessment.questions) {
        maxScore += assessmentQuestion.points;
        const answer = attempt.answers.find((item) => item.questionId === assessmentQuestion.questionId);
        if (!answer) {
            continue;
        }
        if (assessmentQuestion.question.type === "MCQ") {
            const isCorrect =
                JSON.stringify(answer.response) === JSON.stringify(assessmentQuestion.question.correctAnswer);
            const pointsAwarded = isCorrect ? assessmentQuestion.points : 0;
            score += pointsAwarded;
            await tx.answer.update({
                where: { id: answer.id },
                data: { isCorrect, pointsAwarded },
            });
        }
    }

    const submitted = await tx.attempt.updateMany({
        where: { id: attemptId, status: "IN_PROGRESS" },
        data: {
            status: "SUBMITTED",
            submittedAt: new Date(),
            score,
            maxScore,
        },
    });
    if (submitted.count === 0) {
        throw new AppError(httpStatus.CONFLICT, "Attempt has already been submitted");
    }
};

const startAttemptIntoDB = async (userId: string, invitationId: string) => {
    const invitation = await prisma.invitation.findUnique({
        where: { id: invitationId },
        include: {
            assessment: true,
            attempt: true,
        },
    });

    if (!invitation) {
        throw new AppError(httpStatus.NOT_FOUND, "Invitation not found");
    }
    if (invitation.candidateId !== userId) {
        throw new AppError(httpStatus.FORBIDDEN, "You are not allowed to start this attempt");
    }
    if (invitation.status === "DECLINED" || invitation.status === "EXPIRED") {
        throw new AppError(httpStatus.BAD_REQUEST, "This invitation is no longer valid");
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
        await prisma.invitation.update({
            where: { id: invitationId },
            data: { status: "EXPIRED" },
        });
        throw new AppError(httpStatus.BAD_REQUEST, "This invitation has expired");
    }
    if (invitation.attempt) {
        throw new AppError(httpStatus.BAD_REQUEST, "An attempt already exists for this invitation");
    }
    if (invitation.assessment.status !== "PUBLISHED") {
        throw new AppError(httpStatus.BAD_REQUEST, "This assessment is not currently published");
    }

    return prisma.$transaction(async (tx) => {
        if (invitation.status === "PENDING") {
            await tx.invitation.update({
                where: { id: invitationId },
                data: { status: "ACCEPTED" },
            });
        }

        const attempt = await tx.attempt.create({
            data: {
                invitationId,
                candidateId: userId,
                status: "IN_PROGRESS",
                startedAt: new Date(),
                deadline: new Date(Date.now() + invitation.assessment.durationMins * 60 * 1000),
            },
            include: {
                invitation: {
                    include: {
                        assessment: {
                            select: {
                                id: true,
                                title: true,
                                durationMins: true,
                            },
                        },
                    },
                },
            },
        });

        return attempt;
    });
};

const getAttemptFromDB = async (userId: string, role: UserRole, attemptId: string) => {
    const attempt = await prisma.attempt.findUnique({
        where: { id: attemptId },
        include: {
            answers: true,
            invitation: {
                include: {
                    assessment: {
                        include: {
                            questions: {
                                include: { question: true },
                                orderBy: { order: "asc" },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!attempt) {
        throw new AppError(httpStatus.NOT_FOUND, "Attempt not found");
    }

    if (role === "CANDIDATE") {
        if (attempt.candidateId !== userId) {
            throw new AppError(httpStatus.FORBIDDEN, "You are not allowed to view this attempt");
        }
    } else {
        const companyId = await getCompanyIdFromUser(userId);
        if (attempt.invitation.assessment.companyId !== companyId) {
            throw new AppError(httpStatus.FORBIDDEN, "You are not allowed to view this attempt");
        }
    }

    const expired = await expireIfStale(attemptId, attempt.status, attempt.deadline);
    if (expired) {
        attempt.status = "EXPIRED";
    }

    if (role === "CANDIDATE" && !attempt.resultReleased) {
        return {
            ...attempt,
            score: null,
            maxScore: null,
            evaluatorNote: null,
            answers: attempt.answers.map((answer) => ({
                ...answer,
                isCorrect: null,
                pointsAwarded: null,
            })),
        };
    }

    return attempt;
};

const updateAttemptIntoDB = async (userId: string, attemptId: string, payload: IUpdateAttemptPayload) => {
    const attempt = await prisma.attempt.findUnique({
        where: { id: attemptId },
        include: {
            invitation: {
                include: {
                    assessment: {
                        include: {
                            questions: { select: { questionId: true } },
                        },
                    },
                },
            },
        },
    });

    if (!attempt) {
        throw new AppError(httpStatus.NOT_FOUND, "Attempt not found");
    }
    if (attempt.candidateId !== userId) {
        throw new AppError(httpStatus.FORBIDDEN, "You are not allowed to update this attempt");
    }

    const expired = await expireIfStale(attemptId, attempt.status, attempt.deadline);
    if (expired) {
        throw new AppError(httpStatus.BAD_REQUEST, "Attempt has expired before submission");
    }

    if (attempt.status !== "IN_PROGRESS") {
        throw new AppError(httpStatus.BAD_REQUEST, `Cannot update an attempt with status ${attempt.status}`);
    }

    const allowedQuestionIds = new Set(attempt.invitation.assessment.questions.map((item) => item.questionId));
    if (payload.answers) {
        for (const answer of payload.answers) {
            if (!allowedQuestionIds.has(answer.questionId)) {
                throw new AppError(
                    httpStatus.BAD_REQUEST,
                    `Question ${answer.questionId} is not part of this assessment`,
                );
            }
        }
    }

    const result = await prisma.$transaction(async (tx) => {
        if (payload.answers) {
            for (const answer of payload.answers) {
                await tx.answer.upsert({
                    where: {
                        attemptId_questionId: {
                            attemptId,
                            questionId: answer.questionId,
                        },
                    },
                    update: { response: answer.response as Prisma.InputJsonValue },
                    create: {
                        attemptId,
                        questionId: answer.questionId,
                        response: answer.response as Prisma.InputJsonValue,
                    },
                });
            }
        }

        if (payload.status === "SUBMITTED") {
            await autoGradeAndSubmit(tx, attemptId);
        }

        return tx.attempt.findUnique({
            where: { id: attemptId },
            include: {
                answers: true,
                invitation: {
                    include: {
                        assessment: {
                            select: {
                                id: true,
                                title: true,
                                durationMins: true,
                            },
                        },
                    },
                },
            },
        });
    });

    return result;
};

const evaluateAttemptIntoDB = async (userId: string, attemptId: string, payload: IEvaluateAttemptPayload) => {
    const companyId = await getCompanyIdFromUser(userId);

    const attempt = await prisma.attempt.findUnique({
        where: { id: attemptId },
        include: {
            answers: true,
            invitation: {
                include: {
                    assessment: {
                        include: {
                            questions: {
                                include: { question: true },
                                orderBy: { order: "asc" },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!attempt) {
        throw new AppError(httpStatus.NOT_FOUND, "Attempt not found");
    }
    if (attempt.invitation.assessment.companyId !== companyId) {
        throw new AppError(httpStatus.FORBIDDEN, "You are not allowed to evaluate this attempt");
    }
    if (attempt.status !== "SUBMITTED") {
        throw new AppError(httpStatus.BAD_REQUEST, "Only submitted attempts can be evaluated");
    }

    const scoreById = new Map(payload.scores.map((score) => [score.answerId, score.points]));
    const attemptAnswerIds = new Set(attempt.answers.map((answer) => answer.id));
    for (const answerId of scoreById.keys()) {
        if (!attemptAnswerIds.has(answerId)) {
            throw new AppError(httpStatus.BAD_REQUEST, `Answer ${answerId} does not belong to this attempt`);
        }
    }

    const questionTypeById = new Map(
        attempt.invitation.assessment.questions.map((assessmentQuestion) => [
            assessmentQuestion.questionId,
            assessmentQuestion.question.type,
        ]),
    );
    for (const answer of attempt.answers) {
        if (scoreById.has(answer.id) && questionTypeById.get(answer.questionId) === "MCQ") {
            throw new AppError(
                httpStatus.BAD_REQUEST,
                "MCQ answers are auto-graded and cannot be manually scored",
            );
        }
    }

    const result = await prisma.$transaction(async (tx) => {
        for (const answer of attempt.answers) {
            const awarded = scoreById.get(answer.id);
            if (awarded !== undefined) {
                await tx.answer.update({
                    where: { id: answer.id },
                    data: { pointsAwarded: awarded },
                });
            }
        }

        let score = 0;
        let maxScore = 0;
        const updatedAnswers = await tx.answer.findMany({
            where: { attemptId },
        });
        const answerByQuestionId = new Map(updatedAnswers.map((answer) => [answer.questionId, answer]));

        for (const assessmentQuestion of attempt.invitation.assessment.questions) {
            maxScore += assessmentQuestion.points;
            const answer = answerByQuestionId.get(assessmentQuestion.questionId);
            score += answer?.pointsAwarded ?? 0;
        }
        return { score, maxScore };
    });

    const updated = await prisma.attempt.update({
        where: { id: attemptId },
        data: {
            status: "EVALUATED",
            score: result.score,
            maxScore: result.maxScore,
            resultReleased: payload.releaseResult ?? false,
        },
        include: {
            answers: true,
            invitation: {
                include: {
                    assessment: {
                        select: { id: true, title: true },
                    },
                },
            },
        },
    });

    if (payload.releaseResult) {
        await prisma.auditLog.create({
            data: {
                userId,
                action: "RESULT_RELEASED",
                entity: "Attempt",
                entityId: attemptId,
                meta: { score: result.score, maxScore: result.maxScore },
            },
        });
    }

    return updated;
};

const getResultsFromDB = async (userId: string, assessmentId: string, query: IResultsQuery) => {
    const companyId = await getCompanyIdFromUser(userId);

    const assessment = await prisma.assessment.findFirst({
        where: { id: assessmentId, companyId, deletedAt: null },
        select: { id: true },
    });
    if (!assessment) {
        throw new AppError(httpStatus.NOT_FOUND, "Assessment not found");
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where = { invitation: { assessmentId } };

    const [items, total] = await Promise.all([
        prisma.attempt.findMany({
            where,
            skip,
            take: limit,
            orderBy: { startedAt: "desc" },
            include: {
                candidate: { select: { id: true, name: true, email: true } },
                invitation: { select: { status: true } },
            },
        }),
        prisma.attempt.count({ where }),
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

export const attemptService = {
    startAttemptIntoDB,
    getAttemptFromDB,
    updateAttemptIntoDB,
    evaluateAttemptIntoDB,
    getResultsFromDB,
};
