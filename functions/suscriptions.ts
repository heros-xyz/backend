import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import Stripe from "stripe";
import {PaymentMethod} from "./paymentMethod";
import {User} from "./auth";
import {MembershipTier} from "./membershipTiers";

interface SuscriptionCreateParams {
    paymentMethod: string
    membershipTier: string
}

const stripeSecret = "sk_test_51N3iHSIaE495kvrkHHOlGMunzqORnjPCBQImK4D4PccKWmG05QtvdlZleNEi7aS95IodbtAPvjm7LCVNF3EnFymz002NyQmytw"
exports.create = functions.https.onCall(async ({paymentMethod, membershipTier}: SuscriptionCreateParams, context) => {
    const uid = context.auth?.uid
    if (!uid)
        throw new functions.https.HttpsError("permission-denied", "uid")

    const paymentMethodDoc = await admin.firestore().doc(`paymentMethods/${paymentMethod}`).get()
    const paymentMethodDocData = paymentMethodDoc.data() as PaymentMethod
    if (!paymentMethodDocData || paymentMethodDocData.uid !== uid)
        throw new functions.https.HttpsError("permission-denied", "paymentMethod")

    const userDoc = await admin.firestore().doc(`user/${uid}`).get()
    const userDocData = userDoc.data() as User
    if (!userDocData || !userDocData.stripeCustomer)
        throw new functions.https.HttpsError("permission-denied", "customer")

    const membershipTierDoc = await admin.firestore().doc(`membershipTiers/${membershipTier}`).get()
    const membershipTierData = membershipTierDoc.data() as MembershipTier
    if (!membershipTierData || !membershipTierData.stripeProduct)
        throw new functions.https.HttpsError("permission-denied", "product")

    const suscriptionDoc = admin.firestore().collection("subscriptions").doc()

    const stripe = new Stripe(stripeSecret, {apiVersion: "2022-11-15"});
    const suscription = await stripe.subscriptions.create({
        customer: userDocData.stripeCustomer,
        items: [
            {
                price: membershipTierData.stripePrice as string,
                quantity: 1,
            },
        ],
        default_payment_method: paymentMethodDocData.stripePayment,
        metadata: {
            subscriptionId: suscriptionDoc.id,
        },
    });
    return suscriptionDoc.set({
        stripeSubscription: suscription,
        maker: membershipTierData.uid,
        taker: uid
    })
})
