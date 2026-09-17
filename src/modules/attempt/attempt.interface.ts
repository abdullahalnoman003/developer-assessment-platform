export interface IAnswerInput {
    questionId: string;
    response: unknown;
}

export interface IUpdateAttemptPayload {
    answers?: IAnswerInput[];
    status?: "SUBMITTED";
}

export interface IEvaluateAttemptPayload {
    scores: { answerId: string; points: number }[];
    releaseResult?: boolean;
}

export interface IResultsQuery {
    page?: number;
    limit?: number;
}
