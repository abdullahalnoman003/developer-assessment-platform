import { z } from "zod";

export const upsertCompanySchema = z.object({
    name: z.string().trim().min(1, "Company name cannot be empty").max(150).optional(),
    website: z.string().trim().max(500).nullable().optional(),
    logoUrl: z.string().trim().max(1000).nullable().optional(),
});