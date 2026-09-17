import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../global/apperror.js";
import { attemptService } from "./attempt.service.js";

const startAttempt = async (req: Request, res: Response) => {
    try {
        const attempt = await attemptService.startAttemptIntoDB(req.user!.id, req.params.id as string);
        res.status(httpStatus.CREATED).json({
            success: true,
            message: "Attempt started successfully",
            data: attempt,
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

const getAttempt = async (req: Request, res: Response) => {
    try {
        const attempt = await attemptService.getAttemptFromDB(req.user!.id, req.user!.role, req.params.id as string);
        res.status(httpStatus.OK).json({
            success: true,
            message: "Attempt fetched successfully",
            data: attempt,
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

const updateAttempt = async (req: Request, res: Response) => {
    try {
        const attempt = await attemptService.updateAttemptIntoDB(req.user!.id, req.params.id as string, req.body);
        res.status(httpStatus.OK).json({
            success: true,
            message: "Attempt updated successfully",
            data: attempt,
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

const evaluateAttempt = async (req: Request, res: Response) => {
    try {
        const attempt = await attemptService.evaluateAttemptIntoDB(req.user!.id, req.params.id as string, req.body);
        res.status(httpStatus.OK).json({
            success: true,
            message: "Attempt evaluated successfully",
            data: attempt,
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

const getResults = async (req: Request, res: Response) => {
    try {
        const result = await attemptService.getResultsFromDB(req.user!.id, req.params.id as string, req.query);
        res.status(httpStatus.OK).json({
            success: true,
            message: "Results fetched successfully",
            data: result,
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

export const attemptController = {
    startAttempt,
    getAttempt,
    updateAttempt,
    evaluateAttempt,
    getResults,
};
