import { Router } from "express";
import { UserRole } from "../../../generated/prisma/client.js";
import authMiddleware from "../../middleware/auth.middleware.js";
import { validateBody, validateQuery } from "../../middleware/validate.middleware.js";
import { attemptController } from "./attempt.controller.js";
import { evaluateAttemptSchema, resultsQuerySchema, updateAttemptSchema } from "./attempt.validation.js";

const router = Router();

router.post("/invitations/:id/start", authMiddleware(UserRole.CANDIDATE), attemptController.startAttempt);
router.get("/attempts/:id", authMiddleware(UserRole.CANDIDATE, UserRole.RECRUITER), attemptController.getAttempt);
router.patch(
    "/attempts/:id",
    authMiddleware(UserRole.CANDIDATE),
    validateBody(updateAttemptSchema),
    attemptController.updateAttempt,
);
router.post(
    "/attempts/:id/evaluate",
    authMiddleware(UserRole.RECRUITER),
    validateBody(evaluateAttemptSchema),
    attemptController.evaluateAttempt,
);
router.get(
    "/assessments/:id/results",
    authMiddleware(UserRole.RECRUITER),
    validateQuery(resultsQuerySchema),
    attemptController.getResults,
);

export const attemptRoute = router;
