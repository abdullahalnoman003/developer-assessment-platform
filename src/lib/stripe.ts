import Stripe from "stripe";
import config from "../config/index.js";

let client: Stripe | null = null;

const getStripe = (): Stripe => {
    if (!config.stripe_secret_key) {
        throw new Error("Missing required environment variable: STRIPE_SECRET_KEY");
    }
    if (!client) {
        client = new Stripe(config.stripe_secret_key);
    }
    return client;
};

export { getStripe };