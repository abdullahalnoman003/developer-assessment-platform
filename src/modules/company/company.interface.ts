import type { Prisma } from "../../../generated/prisma/client.js";

export interface IUpsertCompany {
    name?: string;
    website?: string | null;
    logoUrl?: string | null;
}

export type CompanyUpdateInput = Prisma.CompanyUpdateInput;