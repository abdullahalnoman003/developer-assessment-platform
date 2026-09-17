import httpStatus from "http-status";
import type Stripe from "stripe";
import type { PaymentProvider, UserRole } from "../../../generated/prisma/client.js";
import config from "../../config/index.js";
import { AppError } from "../../global/apperror.js";
import { prisma } from "../../lib/prisma.js";
import { stripe } from "../../lib/stripe.js";
import type { CreditPlan, IInitiatePayment, IPaymentListQuery } from "./payment.interface.js";

const CREDIT_PLANS: Record<CreditPlan, { credits: number; priceUsd: number }> = {
    STARTER: { credits: 25, priceUsd: 2000 },
    PRO: { credits: 100, priceUsd: 7500 },
    ENTERPRISE: { credits: 300, priceUsd: 20000 },
};

const getCompanyIdFromUser = async (userId: string) => {
    const membership = await prisma.companyMembership.findUnique({
        where: { userId },
        select: { companyId: true },
    });
    if (!membership) {
        throw new AppError(httpStatus.FORBIDDEN, "No company profile found. Create your company first.");
    }
    return membership.companyId;
};

const initiatePaymentIntoDB = async (userId: string, payload: IInitiatePayment) => {
    const companyId = await getCompanyIdFromUser(userId);
    const plan = CREDIT_PLANS[payload.plan];

    const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
            {
                price_data: {
                    currency: "usd",
                    product_data: {
                        name: `CodeArena ${payload.plan} Credits`,
                        description: `${plan.credits} assessment credits for your company`,
                    },
                    unit_amount: plan.priceUsd,
                },
                quantity: 1,
            },
        ],
        success_url: `${config.client_url}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.cancel_url}/payment/cancel`,
        metadata: {
            companyId,
            plan: payload.plan,
            credits: String(plan.credits),
        },
    });

    const payment = await prisma.payment.create({
        data: {
            companyId,
            provider: "STRIPE" as PaymentProvider,
            amount: plan.priceUsd / 100,
            status: "PENDING",
            providerRef: session.id,
            creditsGranted: plan.credits,
        },
    });

    if (!session.url) {
        throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "Failed to create Stripe checkout session");
    }

    return {
        checkoutUrl: session.url,
        payment,
    };
};

const confirmWebhookIntoDB = async (payload: Buffer, signature: string) => {
    if (!config.stripe_webhook_secret) {
        throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "Stripe webhook is not configured");
    }

    const event = stripe.webhooks.constructEvent(payload, signature, config.stripe_webhook_secret);

    if (event.type !== "checkout.session.completed") {
        return null;
    }

    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== "paid") {
        return null;
    }

    const providerRef = session.id;
    const payment = await prisma.payment.findUnique({
        where: { providerRef },
    });

    if (!payment) {
        throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
    }

    if (payment.status === "PAID") {
        return null;
    }

    return prisma.$transaction(async (tx) => {
        const updated = await tx.payment.update({
            where: { providerRef },
            data: { status: "PAID" },
        });
        await tx.company.update({
            where: { id: payment.companyId },
            data: {
                creditsRemaining: {
                    increment: payment.creditsGranted,
                },
            },
        });
        await tx.auditLog.create({
            data: {
                userId: null,
                action: "PAYMENT_CONFIRMED",
                entity: "Payment",
                entityId: payment.id,
                meta: { providerRef, creditsGranted: payment.creditsGranted },
            },
        });
        return updated;
    });
};

const getPaymentsFromDB = async (userId: string, query: IPaymentListQuery) => {
    const companyId = await getCompanyIdFromUser(userId);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where = { companyId };

    const [items, total] = await Promise.all([
        prisma.payment.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
        }),
        prisma.payment.count({ where }),
    ]);

    return {
        items,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

const getPaymentByIdFromDB = async (userId: string, role: UserRole, paymentId: string) => {
    const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
            company: { select: { id: true, name: true } },
        },
    });

    if (!payment) {
        throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
    }

    if (role !== "ADMIN") {
        const companyId = await getCompanyIdFromUser(userId);
        if (payment.companyId !== companyId) {
            throw new AppError(httpStatus.FORBIDDEN, "You are not allowed to view this payment");
        }
    }

    return payment;
};

export const paymentService = {
    initiatePaymentIntoDB,
    confirmWebhookIntoDB,
    getPaymentsFromDB,
    getPaymentByIdFromDB,
};
