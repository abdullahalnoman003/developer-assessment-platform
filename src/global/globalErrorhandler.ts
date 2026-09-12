import type { ErrorRequestHandler } from "express";
import httpStatus from "http-status";
import jwt from "jsonwebtoken";
import { ZodError } from "zod";
import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "./apperror.js";

const globalErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
    let message = "Something went wrong";
    let errors: string[] = [];

    if (error instanceof AppError) {
        statusCode = error.statusCode;
        message = error.message;
    } else if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
        statusCode = httpStatus.UNAUTHORIZED;
        message = "Invalid or expired access token.";
    } else if (error instanceof SyntaxError) {
        statusCode = httpStatus.BAD_REQUEST;
        message = "Invalid request.";
    } else if (error instanceof ZodError) {
        statusCode = httpStatus.BAD_REQUEST;
        message = "Validation failed.";
        errors = error.issues.map((issue) => {
            const path = issue.path.length > 0 ? issue.path.join(".") : "body";
            return `${path}: ${issue.message}`;
        });
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
            statusCode = httpStatus.CONFLICT;
            message = "Resource already exists.";
        } else if (error.code === "P2025") {
            statusCode = httpStatus.NOT_FOUND;
            message = "Resource not found.";
        } else {
            statusCode = httpStatus.INTERNAL_SERVER_ERROR;
            message = "Database operation failed.";
        }
    }

    res.status(statusCode).json({
        success: false,
        message,
        errors,
    });
};

export default globalErrorHandler;