import { z } from "zod";

export const registerSchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(100),
    email: z.string().trim().email("Invalid email address").max(254),
    password: z.string().min(6, "Password must be at least 6 characters").max(128),
    role: z.enum(["CANDIDATE", "RECRUITER"]),
});

export const loginSchema = z.object({
    email: z.string().trim().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
});

export const refreshTokenSchema = z.object({
    refreshToken: z.string().min(1).optional(),
});

export const googleSchema = z.object({
    idToken: z.string().min(1, "Google ID token is required"),
    role: z.enum(["CANDIDATE", "RECRUITER"]).optional(),
});