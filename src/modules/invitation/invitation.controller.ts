import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../global/apperror.js";
import { invitationService } from "./invitation.service.js";

const createInvitations = async (req: Request, res: Response) => {
    try {
        const invitations = await invitationService.createInvitationsIntoDB(
            req.user!.id,
            req.params.id as string,
            req.body,
        );
        res.status(httpStatus.CREATED).json({
            success: true,
            message: "Invitations sent successfully",
            data: invitations,
        });
    } catch (error) {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
                errors: [],
            });
        } else {
            throw error;
        }
    }
};

const getMyInvitations = async (req: Request, res: Response) => {
    try {
        const result = await invitationService.getMyInvitationsFromDB(req.user!.id, req.query);
        res.status(httpStatus.OK).json({
            success: true,
            message: "Invitations fetched successfully",
            data: result,
        });
    } catch (error) {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
                errors: [],
            });
        } else {
            throw error;
        }
    }
};

const updateInvitation = async (req: Request, res: Response) => {
    try {
        const invitation = await invitationService.updateInvitationIntoDB(
            req.user!.id,
            req.user!.role,
            req.params.id as string,
            req.body,
        );
        res.status(httpStatus.OK).json({
            success: true,
            message: "Invitation updated successfully",
            data: invitation,
        });
    } catch (error) {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
                errors: [],
            });
        } else {
            throw error;
        }
    }
};

export const invitationController = {
    createInvitations,
    getMyInvitations,
    updateInvitation,
};
