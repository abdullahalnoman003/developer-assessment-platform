import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Application, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { UserRole } from "../generated/prisma/client.js";

import config from "./config/index.js";
import globalErrorHandler from "./global/globalErrorhandler.js";
import authMiddleware from "./middleware/auth.middleware.js";
import { adminRoute } from "./modules/admin/admin.route.js";
import { assessmentRoute } from "./modules/assessment/assessment.route.js";
import { attemptRoute } from "./modules/attempt/attempt.route.js";
import { authRoute } from "./modules/auth/auth.route.js";
import { companyRoute } from "./modules/company/company.route.js";
import { invitationRoute } from "./modules/invitation/invitation.route.js";
import { paymentController } from "./modules/payment/payment.controller.js";
import { paymentRoute } from "./modules/payment/payment.route.js";
import { questionRoute } from "./modules/question/question.route.js";
import { userRoute } from "./modules/user/user.route.js";

const app: Application = express();

app.post("/api/v1/payments/webhook", express.raw({ type: "application/json" }), paymentController.confirmWebhook);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(helmet());

const allowedOrigins = [config.app_url, config.frontend_url, config.client_url].filter(Boolean);

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error("Not allowed by CORS"));
            }
        },
        credentials: true,
    }),
);

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.originalUrl === "/api/v1/payments/webhook",
});

app.get("/", (_req: Request, res: Response) => {
    res.send("Hello From CodeArena!");
});

app.use("/api/v1", apiLimiter);

app.use("/api/v1/auth", authRoute);
app.use("/api/v1/users", userRoute);
app.use("/api/v1/companies", companyRoute);
app.use("/api/v1/questions", questionRoute);
app.use("/api/v1/assessments", assessmentRoute);
app.use("/api/v1", invitationRoute);
app.use("/api/v1", attemptRoute);
app.use("/api/v1/payments", paymentRoute);
app.use("/api/v1/admin", authMiddleware(UserRole.ADMIN), adminRoute);

app.use(globalErrorHandler);

export default app;
