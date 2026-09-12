import Stripe from "stripe";
import config from "../config/index.js";

if (!config.stripe_secret_key) {
    throw new Error("Missing required environment variable: STRIPE_SECRET_KEY");
}

export const stripe = new Stripe(config.stripe_secret_key);