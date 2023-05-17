import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";


const stripeSecret = "sk_test_51N3iHSIaE495kvrkHHOlGMunzqORnjPCBQImK4D4PccKWmG05QtvdlZleNEi7aS95IodbtAPvjm7LCVNF3EnFymz002NyQmytw"
export const create = functions.auth.user().onCreate(async ({email, uid}) => {
    try {
        const stripe = new Stripe(stripeSecret, {apiVersion: "2022-11-15"});
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
