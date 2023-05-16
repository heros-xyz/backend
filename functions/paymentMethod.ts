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

exports.syncPaymentMethods = functions.firestore.document("paymentMethods/{docId}").onWrite(async (change) => {
    const stripe = new Stripe(stripeSecret, {apiVersion: "2022-11-15"});
    if (!change.before) { //Creando
        const data = change.after.data() as PaymentBefore
        const userDoc = await admin.firestore().doc(`user/${data.uid}`).get()
        if (!userDoc || !userDoc.data()) return
        const customer = userDoc?.data()?.stripeCustomer
        const paymentMethod = await stripe.paymentMethods.create({
            customer,
            card: {
                number: data.cardNumber,
                cvc: data.cardCvc,
                exp_month: data.cardExpMonth,
                exp_year: data.cardExpYear
            }
        }, {})
        return change.after.ref.update({
            stripePayment: paymentMethod,
            ...paymentMethod
        })
    } else if (!change.after) {//Eliminando
        const data = change.before.data() as PaymentAfter
        return stripe.paymentMethods.detach(data.stripePayment)
    } else {
        return
    }
})
