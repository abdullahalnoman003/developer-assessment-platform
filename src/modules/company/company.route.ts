import { Router } from "express";
import { UserRole } from "../../../generated/prisma/client.js";
import authMiddleware from "../../middleware/auth.middleware.js";
import { validateBody } from "../../middleware/validate.middleware.js";
import { companyController } from "./company.controller.js";
import { upsertCompanySchema } from "./company.validation.js";

const router = Router();

router.get("/me/dashboard", authMiddleware(UserRole.RECRUITER), companyController.getDashboard);
router.get("/me", authMiddleware(UserRole.RECRUITER, UserRole.ADMIN), companyController.getMyCompany);
router.put("/me", authMiddleware(UserRole.RECRUITER), validateBody(upsertCompanySchema), companyController.upsertMyCompany);

export const companyRoute = router;