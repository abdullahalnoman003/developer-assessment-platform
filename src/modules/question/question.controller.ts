import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../global/apperror.js";
import { questionService } from "./question.service.js";

const createQuestion = async (req: Request, res: Response) => {
    try {
        const question = await questionService.createQuestionIntoDB(req.user!.id, req.body);
        res.status(httpStatus.CREATED).json({
            success: true,
            message: "Question created successfully",
            data: question,
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

const getQuestions = async (req: Request, res: Response) => {
    try {
        const result = await questionService.getQuestionsFromDB(req.user!.id, req.query);
        res.status(httpStatus.OK).json({
            success: true,
            message: "Questions fetched successfully",
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

const updateQuestion = async (req: Request, res: Response) => {
    try {
        const question = await questionService.updateQuestionIntoDB(
            req.user!.id,
            req.params.id as string,
            req.body,
        );
        res.status(httpStatus.OK).json({
            success: true,
            message: "Question updated successfully",
            data: question,
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

export const questionController = {
    createQuestion,
    getQuestions,
    updateQuestion,
};