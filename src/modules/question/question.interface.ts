import type { Difficulty, QuestionType } from "../../../generated/prisma/client.js";

export interface ICreateQuestion {
    type: QuestionType;
    difficulty: Difficulty;
    title: string;
    body: string;
    options?: unknown;
    correctAnswer?: unknown;
    tags?: string[];
}

export interface IUpdateQuestion {
    type?: QuestionType;
    difficulty?: Difficulty;
    title?: string;
    body?: string;
    options?: unknown;
    correctAnswer?: unknown;
    tags?: string[];
    deletedAt?: "now";
}

export interface IQuestionListQuery {
    type?: string;
    difficulty?: string;
    q?: string;
    page?: number;
    limit?: number;
}