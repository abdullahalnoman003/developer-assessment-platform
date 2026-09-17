import { z } from "zod";

const nullableString = z.string().trim().max(500).nullable().optional();

export const updateProfileSchema = z.object({
    name: z.string().trim().min(1, "Name cannot be empty").max(100).optional(),
    avatarUrl: z.string().trim().max(1000).optional(),
    phone: nullableString,
    bio: nullableString,
    skills: z.array(z.string().trim().min(1).max(50)).max(50).optional(),
    resumeUrl: nullableString,
    githubUrl: nullableString,
});