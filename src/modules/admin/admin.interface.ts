import type { UserRole, UserStatus } from "../../../generated/prisma/client.js";

export interface IUpdateUserStatus {
    status?: UserStatus;
    deletedAt?: "now";
}

export interface IUsersQuery {
    role?: UserRole;
    status?: UserStatus;
    q?: string;
    search?: string;
    page?: number;
    limit?: number;
}

export interface IAuditLogQuery {
    page?: number;
    limit?: number;
    entity?: string;
    action?: string;
}
