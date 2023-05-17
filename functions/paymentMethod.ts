import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import Stripe from "stripe";

const stripeSecret  = "sk_test_51N3iHSIaE495kvrkHHOlGMunzqORnjPCBQImK4D4PccKWmG05QtvdlZleNEi7aS95IodbtAPvjm7LCVNF3EnFymz002NyQmytw"
interface PaymentBefore {
    cardName: string
    cardNumber: string
    cardExpMonth: number
    cardExpYear: number
    cardCvc: string
    uid: string
}
interface PaymentAfter {
    stripePayment: string
    uid: string
}

exports.createPaymentMethods = functions.firestore.document("paymentMethods/{docId}").onCreate(async (change) => {
    const stripe = new Stripe(stripeSecret, {apiVersion: "2022-11-15"});
    const data = change.data() as PaymentBefore
    if (!data.uid) return
    const userDoc = await admin.firestore().doc(`user/${data.uid}`).get()
    if (!userDoc || !userDoc.data()) return
    const customer = userDoc?.data()?.stripeCustomer
    if(!customer) return
    const paymentMethod = await stripe.paymentMethods.create({
        type: "card",
        card: {
            number: data.cardNumber,
            cvc: data.cardCvc,
            exp_month: data.cardExpMonth,
            exp_year: data.cardExpYear
        }
    })
    await stripe.paymentMethods.attach(paymentMethod.id, {
        customer
    })
    return change.ref.set({
        stripePayment: paymentMethod,
        uid: data.uid,
    })
})

exports.deletePaymentMethod = functions.firestore.document("paymentMethods/{docId}").onDelete((change)=>{
    const data = change.data() as PaymentAfter
    if (!data.stripePayment) return
    const stripe = new Stripe(stripeSecret, {apiVersion: "2022-11-15"});
    return stripe.paymentMethods.detach(data.stripePayment, {
        idempotencyKey: `payment_detach_${change.id}`
    })
})
