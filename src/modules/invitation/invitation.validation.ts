import { z } from "zod";

export const inviteSchema = z.object({
    candidateEmails: z
        .array(z.string().trim().email("Invalid email address").max(254))
        .min(1, "Provide at least one candidate email")
        .max(100),
});

export const updateInvitationSchema = z.object({
    status: z.enum(["ACCEPTED", "DECLINED"]),
});

export const invitationListQuerySchema = z.object({
    status: z.enum(["PENDING", "ACCEPTED", "DECLINED", "EXPIRED"]).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
});