import { z } from "zod";

export const createAssessmentSchema = z.object({
    title: z.string().trim().min(1, "Title is required").max(300),
    description: z.string().trim().max(5000).nullable().optional(),
    durationMins: z.coerce.number().int().min(1, "Duration must be at least 1 minute").max(600),
    passScore: z.coerce.number().int().min(0).nullable().optional(),
});

export const updateAssessmentSchema = z.object({
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    durationMins: z.coerce.number().int().min(1).max(600).optional(),
    passScore: z.coerce.number().int().min(0).nullable().optional(),
    questionIds: z.array(z.string().trim().min(1)).max(200).optional(),
    status: z.enum(["PUBLISHED", "CLOSED", "ARCHIVED"]).optional(),
    deletedAt: z.literal("now").optional(),
});

export const assessmentListQuerySchema = z.object({
    status: z.enum(["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"]).optional(),
    sortBy: z.enum(["createdAt", "title"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
});