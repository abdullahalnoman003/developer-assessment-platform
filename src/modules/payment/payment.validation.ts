import { z } from "zod";

export const initiatePaymentSchema = z.object({
    plan: z.enum(["STARTER", "PRO", "ENTERPRISE"]),
});

export const paymentListQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
});
