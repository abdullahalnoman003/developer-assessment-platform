import type { AssessmentStatus } from "../../../generated/prisma/client.js";

export interface ICreateAssessment {
    title: string;
    description?: string;
    durationMins: number;
    passScore?: number;
}

export interface IReplaceQuestions {
    questionIds: string[];
}

export interface IAssessmentStatusTransition {
    status: AssessmentStatus;
}
