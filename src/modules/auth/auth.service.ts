import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { OAuth2Client, type TokenPayload } from "google-auth-library";
import httpStatus from "http-status";
import jwt from "jsonwebtoken";
import { AuthProvider, type User, UserRole } from "../../../generated/prisma/client.js";
import config from "../../config/index.js";
import { AppError } from "../../global/apperror.js";
import { prisma } from "../../lib/prisma.js";
import type { ILoginUser, IRegisterUser, JwtUserPayload } from "./auth.interface.js";

const hashToken = (token: string): string => crypto.createHash("sha256").update(token).digest("hex");

const signAccessToken = (payload: { id: string; email: string; role: string }): string =>
    jwt.sign(payload, config.jwt_access_secret, {
        expiresIn: config.jwt_access_expires_in,
    } as jwt.SignOptions);

const signRefreshToken = (payload: { id: string; email: string; role: string }): string =>
    jwt.sign(payload, config.jwt_refresh_secret, {
        expiresIn: config.jwt_refresh_expires_in,
    } as jwt.SignOptions);

const getTokenPayload = (user: { id: string; email: string; role: UserRole }) => ({
    id: user.id,
    email: user.email,
    role: user.role,
});

const parseExpiresIn = (value: string): number => {
    const match = value.match(/^(\d+)\s*(s|m|h|d|w)?$/i);
    if (!match) {
        return 7 * 24 * 60 * 60 * 1000;
    }
    const amount = Number(match[1]);
    const unit = (match[2] ?? "d").toLowerCase();
    const multiplierByUnit: Record<string, number> = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        w: 7 * 24 * 60 * 60 * 1000,
    };
    return amount * (multiplierByUnit[unit] ?? 24 * 60 * 60 * 1000);
};

const issueTokens = async (user: Pick<User, "id" | "email" | "role">) => {
    const accessToken = signAccessToken(getTokenPayload(user));
    const refreshToken = signRefreshToken(getTokenPayload(user));

    await prisma.refreshToken.create({
        data: {
            userId: user.id,
            tokenHash: hashToken(refreshToken),
            expiresAt: new Date(Date.now() + parseExpiresIn(config.jwt_refresh_expires_in)),
        },
    });

    return { accessToken, refreshToken };
};

const registerUserIntoDB = async (payload: IRegisterUser) => {
    const { name, email, password, role } = payload;
    const normalizedEmail = email.toLowerCase();

    if (role === UserRole.ADMIN) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "Admin accounts cannot be self-registered. Please contact the administrator.",
        );
    }

    const isUserExist = await prisma.user.findUnique({
        where: { email: normalizedEmail },
    });
    if (isUserExist) {
        throw new AppError(httpStatus.CONFLICT, "User already exists");
    }

    const hashedPassword = await bcrypt.hash(password, Number(config.bcrypt_salt_rounds) || 10);

    const user = await prisma.user.create({
        data: {
            name,
            email: normalizedEmail,
            passwordHash: hashedPassword,
            role,
        },
        omit: {
            passwordHash: true,
        },
    });

    return user;
};

const loginUserIntoDB = async (payload: ILoginUser) => {
    const { email, password } = payload;
    const user = await prisma.user.findFirst({
        where: { email: email.toLowerCase(), deletedAt: null },
    });

    if (!user) {
        throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }
    if (user.status === "SUSPENDED") {
        throw new AppError(
            httpStatus.FORBIDDEN,
            "Your account has been suspended. Please contact support for assistance.",
        );
    }

    const isPasswordMatched = await bcrypt.compare(password, user.passwordHash ?? "");
    if (!isPasswordMatched) {
        throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password");
    }

    return issueTokens(user);
};

const refreshTokenIntoDB = async (token: string | undefined) => {
    if (!token) {
        throw new AppError(httpStatus.BAD_REQUEST, "Refresh token is required");
    }

    let decoded: JwtUserPayload;
    try {
        decoded = jwt.verify(token, config.jwt_refresh_secret) as JwtUserPayload;
    } catch {
        throw new AppError(httpStatus.UNAUTHORIZED, "Invalid refresh token");
    }

    const tokenHash = hashToken(token);
    const storedToken = await prisma.refreshToken.findFirst({
        where: {
            userId: decoded.id,
            tokenHash,
            revokedAt: null,
        },
    });

    if (!storedToken) {
        throw new AppError(httpStatus.UNAUTHORIZED, "Invalid or already used refresh token");
    }
    if (storedToken.expiresAt < new Date()) {
        throw new AppError(httpStatus.UNAUTHORIZED, "Refresh token has expired");
    }

    const user = await prisma.user.findFirst({
        where: { id: storedToken.userId, deletedAt: null },
    });
    if (!user) {
        throw new AppError(httpStatus.UNAUTHORIZED, "User not found");
    }

    await prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
    });

    return issueTokens(user);
};

const googleLoginIntoDB = async (idToken: string, role?: UserRole) => {
    if (!config.google_client_id) {
        throw new AppError(httpStatus.BAD_GATEWAY, "Google login is not configured");
    }

    const client = new OAuth2Client(config.google_client_id);
    let payload: TokenPayload | undefined;

    try {
        const ticket = await client.verifyIdToken({
            idToken,
            audience: config.google_client_id,
        });
        payload = ticket.getPayload();
    } catch {
        throw new AppError(httpStatus.UNAUTHORIZED, "Invalid Google ID token");
    }

    if (!payload?.email) {
        throw new AppError(httpStatus.UNAUTHORIZED, "Google account has no email address");
    }

    const email = payload.email.toLowerCase();
    const existing = await prisma.user.findFirst({ where: { email } });
    if (existing?.deletedAt) {
        throw new AppError(httpStatus.UNAUTHORIZED, "This account has been deleted");
    }

    const user = await prisma.user.upsert({
        where: { email },
        create: {
            name: payload.name ?? email.split("@")[0] ?? "",
            email,
            role: role ?? UserRole.CANDIDATE,
            authProvider: AuthProvider.GOOGLE,
            ...(payload.picture ? { avatarUrl: payload.picture } : {}),
        },
        update: {
            ...(payload.name ? { name: payload.name } : {}),
            ...(payload.picture ? { avatarUrl: payload.picture } : {}),
        },
        omit: {
            passwordHash: true,
        },
    });

    return issueTokens(user);
};

const getUserByIdIntoDB = async (id: string) => {
    const user = await prisma.user.findUnique({
        where: { id },
        include: {
            companyMembership: {
                include: {
                    company: true,
                },
            },
        },
        omit: {
            passwordHash: true,
        },
    });
    if (!user) {
        throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }
    return user;
};

export const authService = {
    registerUserIntoDB,
    loginUserIntoDB,
    refreshTokenIntoDB,
    googleLoginIntoDB,
    getUserByIdIntoDB,
};