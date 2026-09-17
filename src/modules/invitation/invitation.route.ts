import { Router } from "express";
import { UserRole } from "../../../generated/prisma/client.js";
import authMiddleware from "../../middleware/auth.middleware.js";
import { validateBody, validateQuery } from "../../middleware/validate.middleware.js";
import { invitationController } from "./invitation.controller.js";
import { invitationListQuerySchema, inviteSchema, updateInvitationSchema } from "./invitation.validation.js";

const router = Router();

router.post(
    "/assessments/:id/invitations",
    authMiddleware(UserRole.RECRUITER),
    validateBody(inviteSchema),
    invitationController.createInvitations,
);
router.get(
    "/invitations/me",
    authMiddleware(UserRole.CANDIDATE),
    validateQuery(invitationListQuerySchema),
    invitationController.getMyInvitations,
);
router.patch(
    "/invitations/:id",
    authMiddleware(UserRole.CANDIDATE, UserRole.RECRUITER),
    validateBody(updateInvitationSchema),
    invitationController.updateInvitation,
);

export const invitationRoute = router;
