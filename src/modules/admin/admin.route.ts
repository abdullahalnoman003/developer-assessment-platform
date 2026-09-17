import { Router } from "express";
import { validateBody, validateQuery } from "../../middleware/validate.middleware.js";
import { adminController } from "./admin.controller.js";
import { auditLogListQuerySchema, updateUserStatusSchema, userListQuerySchema } from "./admin.validation.js";

const router = Router();

router.get("/users", validateQuery(userListQuerySchema), adminController.getUsers);
router.patch("/users/:id", validateBody(updateUserStatusSchema), adminController.updateUserStatus);
router.get("/stats", adminController.getStats);
router.get("/audit-logs", validateQuery(auditLogListQuerySchema), adminController.getAuditLogs);

export const adminRoute = router;
