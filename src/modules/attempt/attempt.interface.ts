import type { AttemptStatus } from "../../../generated/prisma/client.js";

export interface IAnswerInput {
    questionId: string;
    response: unknown;
}

export interface ISaveAnswers {
    answers: IAnswerInput[];
}

export interface IAttemptTransition {
    status: AttemptStatus;
}
