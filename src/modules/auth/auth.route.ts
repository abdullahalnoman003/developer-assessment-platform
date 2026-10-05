import { Router } from "express";
import rateLimit from "express-rate-limit";
import authMiddleware from "../../middleware/auth.middleware.js";
import { validateBody } from "../../middleware/validate.middleware.js";
import { authController } from "./auth.controller.js";
import {
    forgotPasswordSchema,
    googleSchema,
    loginSchema,
    logoutSchema,
    refreshTokenSchema,
    registerSchema,
    resetPasswordSchema,
} from "./auth.validation.js";

const router = Router();

// tighter than the global limiter so reset emails cannot be spammed
const passwordResetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many password reset attempts. Please try again in a few minutes.",
        errors: [],
    },
});

router.post("/register", validateBody(registerSchema), authController.registerUser);
router.post("/login", validateBody(loginSchema), authController.loginUser);
router.post("/google", validateBody(googleSchema), authController.googleLogin);
router.post("/refresh-token", validateBody(refreshTokenSchema), authController.refreshToken);
router.post(
    "/forgot-password",
    passwordResetLimiter,
    validateBody(forgotPasswordSchema),
    authController.forgotPassword,
);
router.post("/reset-password", passwordResetLimiter, validateBody(resetPasswordSchema), authController.resetPassword);
router.post("/logout", authMiddleware(), validateBody(logoutSchema), authController.logoutUser);
router.get("/me", authMiddleware(), authController.getLoggedInUser);

export const authRoute = router;