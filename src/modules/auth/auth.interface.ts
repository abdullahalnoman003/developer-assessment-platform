import type { JwtPayload } from "jsonwebtoken";
import type { UserRole } from "../../../generated/prisma/client.js";

export interface IRegisterUser {
    name: string;
    email: string;
    password: string;
    role: UserRole;
}

export interface ILoginUser {
    email: string;
    password: string;
}

export interface UserInfo {
    id: string;
    email: string;
    role: UserRole;
}

export interface JwtUserPayload extends JwtPayload {
    id: string;
    email: string;
    role: UserRole;
}
