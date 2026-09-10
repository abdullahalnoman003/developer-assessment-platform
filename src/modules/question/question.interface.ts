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
