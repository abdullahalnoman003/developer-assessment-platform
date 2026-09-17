import { z } from "zod";

export const updateUserStatusSchema = z
    .object({
        status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
        deletedAt: z.literal("now").optional(),
    })
    .refine((data) => data.status !== undefined || data.deletedAt !== undefined, {
        message: "Either status or deletedAt must be provided",
        path: ["status"],
    });

export const userListQuerySchema = z.object({
    role: z.enum(["CANDIDATE", "RECRUITER", "ADMIN"]).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
    q: z.string().trim().min(1).optional(),
    search: z.string().trim().min(1).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
});

export const auditLogListQuerySchema = z.object({
    entity: z.string().trim().min(1).optional(),
    action: z.string().trim().min(1).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
});
