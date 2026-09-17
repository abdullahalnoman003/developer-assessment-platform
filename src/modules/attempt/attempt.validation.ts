import { z } from "zod";

export const updateAttemptSchema = z
    .object({
        answers: z
            .array(
                z.object({
                    questionId: z.string().trim().min(1),
                    response: z.unknown(),
                }),
            )
            .max(500)
            .optional(),
        status: z.literal("SUBMITTED").optional(),
    })
    .refine((payload) => payload.answers !== undefined || payload.status !== undefined, {
        message: "Provide answers to save or status SUBMITTED to submit",
    });

export const evaluateAttemptSchema = z.object({
    scores: z
        .array(
            z.object({
                answerId: z.string().trim().min(1),
                points: z.coerce.number().min(0).max(10000),
            }),
        )
        .min(1, "Provide at least one score")
        .max(500),
    releaseResult: z.boolean().optional(),
});

export const resultsQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
});
