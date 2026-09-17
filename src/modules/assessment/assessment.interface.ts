import type { AssessmentStatus } from "../../../generated/prisma/client.js";

export interface ICreateAssessment {
    title: string;
    description?: string | null;
    durationMins: number;
    passScore?: number | null;
}

export interface IReplaceQuestions {
    questionIds: string[];
}

export interface IAssessmentStatusTransition {
    status: AssessmentStatus;
}

export interface IUpdateAssessment {
    title?: string;
    description?: string | null;
    durationMins?: number;
    passScore?: number | null;
    questionIds?: string[];
    status?: AssessmentStatus;
}

export interface IAssessmentListQuery {
    status?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    limit?: number;
}