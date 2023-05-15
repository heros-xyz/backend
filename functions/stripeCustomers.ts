import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";


const STRIPE_SECRET = "sk_test_51N3iHSIaE495kvrkHHOlGMunzqORnjPCBQImK4D4PccKWmG05QtvdlZleNEi7aS95IodbtAPvjm7LCVNF3EnFymz002NyQmytw"
export const onUserCreate = functions.auth.user().onCreate(async ({email, uid}) => {
    const stripeSecret = STRIPE_SECRET
    const stripe = new Stripe(stripeSecret, {apiVersion: "2022-11-15"});
    try {
        console.log(email, uid)
        const customer = await stripe.customers.create({
            email: email,
            metadata: { firebaseUID: uid },
        });
        console.log(customer.id)
        await admin.firestore()
            .collection("stripeCustomers")
            .doc(uid)
            .set({ customerId: customer.id }, {merge: true});
        console.log("Aca!")
    } catch (error) {
        console.error("Error al crear el cliente de Stripe", error);
    }
})
