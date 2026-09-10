import type { UserStatus } from "../../../generated/prisma/client.js";

export interface IUpdateUserStatus {
    status: UserStatus;
}
