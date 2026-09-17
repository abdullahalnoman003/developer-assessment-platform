import { Router } from "express";
import { UserRole } from "../../../generated/prisma/client.js";
import authMiddleware from "../../middleware/auth.middleware.js";
import { validateBody, validateQuery } from "../../middleware/validate.middleware.js";
import { assessmentController } from "./assessment.controller.js";
import {
    assessmentListQuerySchema,
    createAssessmentSchema,
    updateAssessmentSchema,
} from "./assessment.validation.js";

const router = Router();

router.post(
    "/",
    authMiddleware(UserRole.RECRUITER),
    validateBody(createAssessmentSchema),
    assessmentController.createAssessment,
);
router.get(
    "/",
    authMiddleware(UserRole.RECRUITER),
    validateQuery(assessmentListQuerySchema),
    assessmentController.getAssessments,
);
router.get("/:id", authMiddleware(UserRole.RECRUITER), assessmentController.getAssessmentById);
router.patch(
    "/:id",
    authMiddleware(UserRole.RECRUITER),
    validateBody(updateAssessmentSchema),
    assessmentController.updateAssessment,
);

export const assessmentRoute = router;