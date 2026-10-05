import nodemailer, { type Transporter } from "nodemailer";
import config from "../config/index.js";

let cachedTransporter: Transporter | null = null;

const getTransporter = (): Transporter | null => {
    if (!config.smtp_user || !config.smtp_pass) {
        return null;
    }
    if (cachedTransporter) {
        return cachedTransporter;
    }

    const port = Number(config.smtp_port) || 465;
    cachedTransporter = nodemailer.createTransport({
        // defaults to Gmail's SMTP server
        host: config.smtp_host || "smtp.gmail.com",
        port,
        secure: port === 465,
        auth: {
            user: config.smtp_user,
            pass: config.smtp_pass,
        },
    });
    return cachedTransporter;
};

export interface PasswordResetEmail {
    to: string;
    name: string;
    resetUrl: string;
}

export const sendPasswordResetEmail = async ({
    to,
    name,
    resetUrl,
}: PasswordResetEmail): Promise<{ delivered: boolean }> => {
    const transporter = getTransporter();
    if (!transporter) {
        return { delivered: false };
    }

    const from = config.mail_from || `CodeArena <${config.smtp_user}>`;

    await transporter.sendMail({
        from,
        to,
        subject: "Reset your CodeArena password",
        text: [
            `Hi ${name},`,
            "",
            "We received a request to reset your CodeArena password.",
            "Open the link below to choose a new one. It expires in 15 minutes.",
            "",
            resetUrl,
            "",
            "If you did not request this, you can safely ignore this email.",
        ].join("\n"),
        html: `
            <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
                <h2 style="color: #4f46e5;">Reset your password</h2>
                <p>Hi ${name},</p>
                <p>We received a request to reset your CodeArena password. Click the button below to choose a new one. This link expires in 15 minutes.</p>
                <p style="margin: 28px 0;">
                    <a href="${resetUrl}" style="background: #4f46e5; color: #ffffff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">Reset password</a>
                </p>
                <p style="font-size: 13px; color: #6b7280;">If the button does not work, copy and paste this link into your browser:</p>
                <p style="font-size: 13px; word-break: break-all; color: #4f46e5;">${resetUrl}</p>
                <p style="font-size: 13px; color: #6b7280;">If you did not request this, you can safely ignore this email.</p>
            </div>
        `,
    });

    return { delivered: true };
};
