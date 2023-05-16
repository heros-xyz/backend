import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";


const STRIPE_SECRET = "sk_test_51N3iHSIaE495kvrkHHOlGMunzqORnjPCBQImK4D4PccKWmG05QtvdlZleNEi7aS95IodbtAPvjm7LCVNF3EnFymz002NyQmytw"
const stripeSecret  = STRIPE_SECRET
export const onUserCreate = functions.auth.user().onCreate(async ({email, uid}) => {
    const stripe = new Stripe(stripeSecret, {apiVersion: "2022-11-15"});
    try {
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
        console.error("Error al crear el cliente de Stripe", error);
    }
})
