import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client.js";
import { AppError } from "../../global/apperror.js";
import { prisma } from "../../lib/prisma.js";
import type { ICreateQuestion, IQuestionListQuery, IUpdateQuestion } from "./question.interface.js";

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

const createQuestionIntoDB = async (userId: string, payload: ICreateQuestion) => {
    const companyId = await getCompanyIdFromUser(userId);

    const question = await prisma.question.create({
        data: {
            companyId,
            type: payload.type,
            difficulty: payload.difficulty,
            title: payload.title,
            body: payload.body,
            ...(payload.options !== undefined ? { options: payload.options as Prisma.InputJsonValue } : {}),
            ...(payload.correctAnswer !== undefined
                ? { correctAnswer: payload.correctAnswer as Prisma.InputJsonValue }
                : {}),
            ...(payload.tags !== undefined ? { tags: payload.tags } : {}),
        },
    });

    return question;
};

const getQuestionsFromDB = async (userId: string, query: IQuestionListQuery) => {
    const companyId = await getCompanyIdFromUser(userId);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.QuestionWhereInput = {
        companyId,
        deletedAt: null,
        ...(query.type ? { type: query.type as ICreateQuestion["type"] } : {}),
        ...(query.difficulty ? { difficulty: query.difficulty as ICreateQuestion["difficulty"] } : {}),
        ...(query.q
            ? {
                  OR: [
                      { title: { contains: query.q, mode: "insensitive" } },
                      { body: { contains: query.q, mode: "insensitive" } },
                  ],
              }
            : {}),
    };

    const [items, total] = await Promise.all([
        prisma.question.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
        }),
        prisma.question.count({ where }),
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

const updateQuestionIntoDB = async (userId: string, questionId: string, payload: IUpdateQuestion) => {
    const companyId = await getCompanyIdFromUser(userId);

    const existing = await prisma.question.findFirst({
        where: { id: questionId, companyId, deletedAt: null },
    });
    if (!existing) {
        throw new AppError(httpStatus.NOT_FOUND, "Question not found");
    }

    if (payload.deletedAt === "now") {
        const question = await prisma.question.update({
            where: { id: questionId },
            data: { deletedAt: new Date() },
        });
        return question;
    }

    const data: Prisma.QuestionUpdateInput = {};
    if (payload.type) {
        data.type = payload.type;
    }
    if (payload.difficulty) {
        data.difficulty = payload.difficulty;
    }
    if (payload.title !== undefined) {
        data.title = payload.title;
    }
    if (payload.body !== undefined) {
        data.body = payload.body;
    }
    if (payload.options !== undefined) {
        data.options = payload.options as Prisma.InputJsonValue;
    }
    if (payload.correctAnswer !== undefined) {
        data.correctAnswer = payload.correctAnswer as Prisma.InputJsonValue;
    }
    if (payload.tags !== undefined) {
        data.tags = { set: payload.tags };
    }

    const question = await prisma.question.update({
        where: { id: questionId },
        data,
    });

    return question;
};

export const questionService = {
    createQuestionIntoDB,
    getQuestionsFromDB,
    updateQuestionIntoDB,
};