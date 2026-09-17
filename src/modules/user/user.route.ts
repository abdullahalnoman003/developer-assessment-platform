import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import { validateBody } from "../../middleware/validate.middleware.js";
import { userController } from "./user.controller.js";
import { updateProfileSchema } from "./user.validation.js";

const router = Router();

router.get("/me", authMiddleware(), userController.getMe);
router.patch("/me", authMiddleware(), validateBody(updateProfileSchema), userController.updateMe);

export const userRoute = router;