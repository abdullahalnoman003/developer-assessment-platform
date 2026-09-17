import { Router } from "express";
import { UserRole } from "../../../generated/prisma/client.js";
import authMiddleware from "../../middleware/auth.middleware.js";
import { validateBody, validateQuery } from "../../middleware/validate.middleware.js";
import { questionController } from "./question.controller.js";
import {
    createQuestionSchema,
    questionListQuerySchema,
    updateQuestionSchema,
} from "./question.validation.js";

const router = Router();

router.post(
    "/",
    authMiddleware(UserRole.RECRUITER),
    validateBody(createQuestionSchema),
    questionController.createQuestion,
);
router.get(
    "/",
    authMiddleware(UserRole.RECRUITER),
    validateQuery(questionListQuerySchema),
    questionController.getQuestions,
);
router.patch(
    "/:id",
    authMiddleware(UserRole.RECRUITER),
    validateBody(updateQuestionSchema),
    questionController.updateQuestion,
);

export const questionRoute = router;