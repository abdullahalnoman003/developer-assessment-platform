import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const requireEnv = (key: string): string => {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
};

export default {
    port: process.env.PORT,
    database_url: process.env.DATABASE_URL,
    app_url: process.env.APP_URL,
    frontend_url: process.env.FRONTEND_URL,
    client_url: process.env.CLIENT_URL,
    cancel_url: process.env.CANCEL_URL,
    bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
    jwt_access_secret: requireEnv("JWT_ACCESS_SECRET"),
    jwt_refresh_secret: requireEnv("JWT_REFRESH_SECRET"),
    jwt_access_expires_in: requireEnv("JWT_ACCESS_EXPIRES_IN"),
    jwt_refresh_expires_in: requireEnv("JWT_REFRESH_EXPIRES_IN"),
    stripe_secret_key: process.env.STRIPE_SECRET_KEY,
    stripe_webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,
    google_client_id: process.env.GOOGLE_CLIENT_ID,
    demo_admin_name: process.env.DEMO_ADMIN_NAME,
    demo_admin_email: process.env.DEMO_ADMIN_EMAIL,
    demo_admin_password: process.env.DEMO_ADMIN_PASSWORD,
    demo_recruiter_name: process.env.DEMO_RECRUITER_NAME,
    demo_recruiter_email: process.env.DEMO_RECRUITER_EMAIL,
    demo_recruiter_password: process.env.DEMO_RECRUITER_PASSWORD,
    demo_candidate_name: process.env.DEMO_CANDIDATE_NAME,
    demo_candidate_email: process.env.DEMO_CANDIDATE_EMAIL,
    demo_candidate_password: process.env.DEMO_CANDIDATE_PASSWORD,
};
