import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../global/apperror.js";
import { paymentService } from "./payment.service.js";

const initiatePayment = async (req: Request, res: Response) => {
    try {
        const result = await paymentService.initiatePaymentIntoDB(req.user!.id, req.body);
        res.status(httpStatus.CREATED).json({
            success: true,
            message: "Payment initiated successfully",
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

const confirmWebhook = async (req: Request, res: Response) => {
    try {
        const payload = req.body as Buffer;
        const signature = req.headers["stripe-signature"] as string;
        await paymentService.confirmWebhookIntoDB(payload, signature);
        res.status(httpStatus.OK).json({
            success: true,
            message: "Webhook processed successfully",
            data: null,
        });
    } catch (error) {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
                errors: [],
            });
        } else {
            res.status(httpStatus.BAD_REQUEST).json({
                success: false,
                message: "Webhook processing failed",
                errors: [],
            });
        }
    }
};

const getPayments = async (req: Request, res: Response) => {
    try {
        const result = await paymentService.getPaymentsFromDB(req.user!.id, req.query);
        res.status(httpStatus.OK).json({
            success: true,
            message: "Payments fetched successfully",
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

const getPaymentById = async (req: Request, res: Response) => {
    try {
        const payment = await paymentService.getPaymentByIdFromDB(
            req.user!.id,
            req.user!.role,
            req.params.id as string,
        );
        res.status(httpStatus.OK).json({
            success: true,
            message: "Payment fetched successfully",
            data: payment,
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

export const paymentController = {
    initiatePayment,
    confirmWebhook,
    getPayments,
    getPaymentById,
};
