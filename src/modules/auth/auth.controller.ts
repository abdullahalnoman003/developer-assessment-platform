import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../global/apperror.js";
import { authService } from "./auth.service.js";

const setTokenCookies = (res: Response, accessToken: string, refreshToken: string) => {
    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: false,
        sameSite: "none",
        maxAge: 1000 * 60 * 60 * 24,
    });

    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: "none",
        maxAge: 1000 * 60 * 60 * 24 * 7,
    });
};

const registerUser = async (req: Request, res: Response) => {
    try {
        const user = await authService.registerUserIntoDB(req.body);
        res.status(httpStatus.CREATED).json({
            success: true,
            message: "User registered successfully",
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

const loginUser = async (req: Request, res: Response) => {
    try {
        const { accessToken, refreshToken } = await authService.loginUserIntoDB(req.body);
        setTokenCookies(res, accessToken, refreshToken);

        res.status(httpStatus.OK).json({
            success: true,
            message: "User logged in successfully",
            data: { accessToken, refreshToken },
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

const googleLogin = async (req: Request, res: Response) => {
    try {
        const { idToken, role } = req.body;
        const { accessToken, refreshToken } = await authService.googleLoginIntoDB(idToken, role);
        setTokenCookies(res, accessToken, refreshToken);

        res.status(httpStatus.OK).json({
            success: true,
            message: "Google login successful",
            data: { accessToken, refreshToken },
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

const refreshToken = async (req: Request, res: Response) => {
    try {
        const token = req.body.refreshToken ?? req.cookies?.refreshToken;
        const { accessToken, refreshToken } = await authService.refreshTokenIntoDB(token);
        setTokenCookies(res, accessToken, refreshToken);

        res.status(httpStatus.OK).json({
            success: true,
            message: "Token refreshed successfully",
            data: { accessToken, refreshToken },
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

const getLoggedInUser = async (req: Request, res: Response) => {
    try {
        const user = await authService.getUserByIdIntoDB(req.user!.id);
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
        } else {
            throw error;
        }
    }
};

export const authController = {
    registerUser,
    loginUser,
    googleLogin,
    refreshToken,
    getLoggedInUser,
};
