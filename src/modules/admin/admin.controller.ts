import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../global/apperror.js";
import { adminService } from "./admin.service.js";

const getUsers = async (req: Request, res: Response) => {
    try {
        const result = await adminService.getUsersFromDB(req.query);
        res.status(httpStatus.OK).json({
            success: true,
            message: "Users fetched successfully",
            data: result,
        });
    } catch (error) {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
                errors: [],
            });
        } else {
            throw error;
        }
    }
};

const updateUserStatus = async (req: Request, res: Response) => {
    try {
        const user = await adminService.updateUserStatusIntoDB(req.user!.id, req.params.id as string, req.body);
        res.status(httpStatus.OK).json({
            success: true,
            message: "User status updated successfully",
            data: user,
        });
    } catch (error) {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
                errors: [],
            });
        } else {
            throw error;
        }
    }
};

const getStats = async (_req: Request, res: Response) => {
    try {
        const stats = await adminService.getStatsFromDB();
        res.status(httpStatus.OK).json({
            success: true,
            message: "Stats fetched successfully",
            data: stats,
        });
    } catch (error) {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
                errors: [],
            });
        } else {
            throw error;
        }
    }
};

const getAuditLogs = async (req: Request, res: Response) => {
    try {
        const result = await adminService.getAuditLogsFromDB(req.query);
        res.status(httpStatus.OK).json({
            success: true,
            message: "Audit logs fetched successfully",
            data: result,
        });
    } catch (error) {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
                errors: [],
            });
        } else {
            throw error;
        }
    }
};

export const adminController = {
    getUsers,
    updateUserStatus,
    getStats,
    getAuditLogs,
};
