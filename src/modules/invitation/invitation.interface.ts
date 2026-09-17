export interface IInviteEmails {
    candidateEmails: string[];
}

export interface IUpdateInvitation {
    status: "ACCEPTED" | "DECLINED";
}

export interface IInvitationListQuery {
    status?: string;
    page?: number;
    limit?: number;
}