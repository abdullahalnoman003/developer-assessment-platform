import { Router } from "express";
import { UserRole } from "../../../generated/prisma/client.js";
import authMiddleware from "../../middleware/auth.middleware.js";
import { validateBody, validateQuery } from "../../middleware/validate.middleware.js";
import { paymentController } from "./payment.controller.js";
import { initiatePaymentSchema, paymentListQuerySchema } from "./payment.validation.js";

const router = Router();

router.post(
    "/initiate",
    authMiddleware(UserRole.RECRUITER),
    validateBody(initiatePaymentSchema),
    paymentController.initiatePayment,
);
router.get(
    "/",
    authMiddleware(UserRole.RECRUITER),
    validateQuery(paymentListQuerySchema),
    paymentController.getPayments,
);
router.get("/:id", authMiddleware(UserRole.RECRUITER, UserRole.ADMIN), paymentController.getPaymentById);

export const paymentRoute = router;
