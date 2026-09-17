import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../global/apperror.js";
import { userService } from "./user.service.js";

const getMe = async (req: Request, res: Response) => {
    try {
        const user = await userService.getMeFromDB(req.user!.id);
        res.status(httpStatus.OK).json({
            success: true,
            message: "User profile fetched successfully",
            data: user,
        });
    } catch (error) {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
                errors: [],
            });
        }
    }
};

const updateMe = async (req: Request, res: Response) => {
    try {
        const user = await userService.updateMeIntoDB(req.user!.id, req.user!.role, req.body);
        res.status(httpStatus.OK).json({
            success: true,
            message: "User profile updated successfully",
            data: user,
        });
    } catch (error) {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
                errors: [],
            });
        }
    }
};

export const userController = {
    getMe,
    updateMe,
};
