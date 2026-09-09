import type { ErrorRequestHandler } from "express";
import httpStatus from "http-status";
import jwt from "jsonwebtoken";
import { AppError } from "./apperror.js";

const globalErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
    let message = "Something went wrong";

    if (error instanceof AppError) {
        statusCode = error.statusCode;
        message = error.message;
    } else if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
        statusCode = httpStatus.UNAUTHORIZED;
        message = "Invalid or expired access token.";
    } else if (error instanceof SyntaxError) {
        statusCode = httpStatus.BAD_REQUEST;
        message = "Invalid request.";
    }

    res.status(statusCode).json({
        success: false,
        message,
        errors: [],
    });
};

export default globalErrorHandler;
