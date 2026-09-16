import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import { validateBody } from "../../middleware/validate.middleware.js";
import { authController } from "./auth.controller.js";
import { googleSchema, loginSchema, refreshTokenSchema, registerSchema } from "./auth.validation.js";

const router = Router();

router.post("/register", validateBody(registerSchema), authController.registerUser);
router.post("/login", validateBody(loginSchema), authController.loginUser);
router.post("/google", validateBody(googleSchema), authController.googleLogin);
router.post("/refresh-token", validateBody(refreshTokenSchema), authController.refreshToken);
router.get("/me", authMiddleware(), authController.getLoggedInUser);

export const authRoute = router;