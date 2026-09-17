import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../global/apperror.js";
import { assessmentService } from "./assessment.service.js";

const createAssessment = async (req: Request, res: Response) => {
    try {
        const assessment = await assessmentService.createAssessmentIntoDB(req.user!.id, req.body);
        res.status(httpStatus.CREATED).json({
            success: true,
            message: "Assessment created successfully",
            data: assessment,
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

const getAssessments = async (req: Request, res: Response) => {
    try {
        const result = await assessmentService.getAssessmentsFromDB(req.user!.id, req.query);
        res.status(httpStatus.OK).json({
            success: true,
            message: "Assessments fetched successfully",
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

const getAssessmentById = async (req: Request, res: Response) => {
    try {
        const assessment = await assessmentService.getAssessmentByIdFromDB(
            req.user!.id,
            req.params.id as string,
        );
        res.status(httpStatus.OK).json({
            success: true,
            message: "Assessment fetched successfully",
            data: assessment,
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

const updateAssessment = async (req: Request, res: Response) => {
    try {
        const assessment = await assessmentService.updateAssessmentIntoDB(
            req.user!.id,
            req.params.id as string,
            req.body,
        );
        res.status(httpStatus.OK).json({
            success: true,
            message: "Assessment updated successfully",
            data: assessment,
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

export const assessmentController = {
    createAssessment,
    getAssessments,
    getAssessmentById,
    updateAssessment,
};