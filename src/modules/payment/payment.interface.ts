export type CreditPlan = "STARTER" | "PRO" | "ENTERPRISE";

export interface IInitiatePayment {
    plan: CreditPlan;
}

export interface IPaymentListQuery {
    page?: number;
    limit?: number;
}
