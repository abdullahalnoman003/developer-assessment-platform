import httpStatus from "http-status";
import type { UserRole } from "../../../generated/prisma/client.js";
import { AppError } from "../../global/apperror.js";
import { prisma } from "../../lib/prisma.js";
import type { IUpdateProfile } from "./user.interface.js";

const getMeFromDB = async (userId: string) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
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

const updateMeIntoDB = async (userId: string, role: UserRole, payload: IUpdateProfile) => {
    const data: Record<string, unknown> = {};

    if (payload.name !== undefined) {
        data.name = payload.name;
    }
    if (payload.avatarUrl !== undefined) {
        data.avatarUrl = payload.avatarUrl;
    }

    if (role === "CANDIDATE") {
        if (payload.phone !== undefined) {
            data.phone = payload.phone;
        }
        if (payload.bio !== undefined) {
            data.bio = payload.bio;
        }
        if (payload.skills !== undefined) {
            data.skills = payload.skills;
        }
        if (payload.resumeUrl !== undefined) {
            data.resumeUrl = payload.resumeUrl;
        }
        if (payload.githubUrl !== undefined) {
            data.githubUrl = payload.githubUrl;
        }
    }

    const user = await prisma.user.update({
        where: { id: userId },
        data,
        omit: {
            passwordHash: true,
        },
    });

    return user;
};

export const userService = {
    getMeFromDB,
    updateMeIntoDB,
};