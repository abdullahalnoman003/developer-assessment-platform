import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import jwt from "jsonwebtoken";
import type { UserRole } from "../../generated/prisma/client.js";
import config from "../config/index.js";
import { AppError } from "../global/apperror.js";
import { prisma } from "../lib/prisma.js";
import type { JwtUserPayload, UserInfo } from "../modules/auth/auth.interface.js";

const authMiddleware =
    (...roles: UserRole[]) =>
    async (req: Request, _res: Response, next: NextFunction) => {
        try {
            const headerToken = req.headers.authorization?.startsWith("Bearer ")
                ? req.headers.authorization.split(" ")[1]
                : undefined;

            const accessToken = headerToken ?? req.cookies?.accessToken;

            if (!accessToken) {
                throw new AppError(httpStatus.UNAUTHORIZED, "Access token is required. Please login again.");
            }

            const decoded = jwt.verify(accessToken, config.jwt_access_secret) as JwtUserPayload;

            const user = await prisma.user.findUnique({
                where: {
                    id: decoded.id,
                },
            });

            if (!user) {
                throw new AppError(httpStatus.UNAUTHORIZED, "User not found.");
            }

            if (roles.length && !roles.includes(user.role)) {
                throw new AppError(httpStatus.FORBIDDEN, "You are not authorized to access this resource.");
            }

            req.user = {
                id: user.id,
                email: user.email,
                role: user.role,
            } as UserInfo;

            next();
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
                return next(new AppError(httpStatus.UNAUTHORIZED, "Invalid or expired access token."));
            }

            next(error);
        }
    };

export default authMiddleware;
