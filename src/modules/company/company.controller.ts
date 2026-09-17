import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../global/apperror.js";
import { companyService } from "./company.service.js";

const getMyCompany = async (req: Request, res: Response) => {
    try {
        const company = await companyService.getCompanyForUserFromDB(req.user!.id);
        res.status(httpStatus.OK).json({
            success: true,
            message: "Company fetched successfully",
            data: company,
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

const upsertMyCompany = async (req: Request, res: Response) => {
    try {
        const company = await companyService.upsertCompanyIntoDB(req.user!.id, req.body);
        res.status(httpStatus.OK).json({
            success: true,
            message: "Company saved successfully",
            data: company,
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

const getDashboard = async (req: Request, res: Response) => {
    try {
        const dashboard = await companyService.getDashboardIntoDB(req.user!.id);
        res.status(httpStatus.OK).json({
            success: true,
            message: "Dashboard fetched successfully",
            data: dashboard,
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

export const companyController = {
    getMyCompany,
    upsertMyCompany,
    getDashboard,
};