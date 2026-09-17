import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import type { ZodError, ZodTypeAny } from "zod";
import { AppError } from "../global/apperror.js";

export const validateBody = (schema: ZodTypeAny) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        next(new AppError(httpStatus.BAD_REQUEST, formatZodError(result.error)));
        return;
    }
    req.body = result.data;
    next();
};

export const validateQuery = (schema: ZodTypeAny) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
        next(new AppError(httpStatus.BAD_REQUEST, formatZodError(result.error)));
        return;
    }
    req.query = result.data as Request["query"];
    next();
};

const formatZodError = (error: ZodError): string => {
    const first = error.issues[0];
    if (!first) {
        return "Invalid input.";
    }
    const path = first.path.length > 0 ? first.path.join(".") : "body";
    return `${path}: ${first.message}`;
};
