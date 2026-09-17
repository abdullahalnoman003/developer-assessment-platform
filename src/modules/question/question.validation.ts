import { z } from "zod";

export const createQuestionSchema = z.object({
    type: z.enum(["MCQ", "WRITTEN", "CODING"]),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    title: z.string().trim().min(1, "Title is required").max(300),
    body: z.string().trim().min(1, "Question body is required").max(10000),
    options: z.unknown().optional(),
    correctAnswer: z.unknown().optional(),
    tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
});

export const updateQuestionSchema = z.object({
    type: z.enum(["MCQ", "WRITTEN", "CODING"]).optional(),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
    title: z.string().trim().min(1).max(300).optional(),
    body: z.string().trim().min(1).max(10000).optional(),
    options: z.unknown().optional(),
    correctAnswer: z.unknown().optional(),
    tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
    deletedAt: z.literal("now").optional(),
});

export const questionListQuerySchema = z.object({
    type: z.enum(["MCQ", "WRITTEN", "CODING"]).optional(),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
    q: z.string().trim().max(200).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
});