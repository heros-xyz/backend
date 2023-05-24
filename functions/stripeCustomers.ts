import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";

const stripeKey = functions.params.defineSecret("STRIPE_KEY");

export const create = functions.runWith({
    secrets: [stripeKey]
}).auth.user().onCreate(async ({email, uid}) => {
    try {
        const stripe = new Stripe(stripeKey.value(), {apiVersion: "2022-11-15"});
        const customer = await stripe.customers.create({
            email: email,
            metadata: { firebaseUID: uid },
        }, {
            idempotencyKey: `user_create_${uid}`
        });
        await admin.firestore()
            .collection("user")
            .doc(uid)
            .update({ stripeCustomer: customer.id });
    } catch (error) {
        console.error(`onUserCreate ${uid}`, error);
    }
})
