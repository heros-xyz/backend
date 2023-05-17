import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import Stripe from "stripe";

const stripeSecret  = "sk_test_51N3iHSIaE495kvrkHHOlGMunzqORnjPCBQImK4D4PccKWmG05QtvdlZleNEi7aS95IodbtAPvjm7LCVNF3EnFymz002NyQmytw"
interface PrePaymentMethod {
    cardName: string
    cardNumber: string
    cardExpMonth: number
    cardExpYear: number
    cardCvc: string
    uid: string
}
export interface PaymentMethod {
    stripePayment?: string
    error?: string
    uid: string
}

const ref = functions.firestore.document("paymentMethods/{docId}")

exports.create = ref.onCreate(async (change) => {
    const data = change.data() as PrePaymentMethod
    if (!data.uid) return
    const userDoc = await admin.firestore().doc(`user/${data.uid}`).get()
    if (!userDoc || !userDoc.data()) return
    const customer = userDoc?.data()?.stripeCustomer
    if(!customer) return

    const stripe = new Stripe(stripeSecret, {apiVersion: "2022-11-15"});
    return stripe.paymentMethods.create({
        type: "card",
        card: {
            number: data.cardNumber,
            cvc: data.cardCvc,
            exp_month: data.cardExpMonth,
            exp_year: data.cardExpYear
        }
    }).then((paymentMethod)=>
        stripe.paymentMethods.attach(paymentMethod.id, {
            customer
        }).then(()=>
            stripe.paymentMethods.retrieve(paymentMethod.id)
        )
    ).then((paymentMethod)=>
        change.ref.set({
            stripePayment: paymentMethod,
            uid: data.uid,
        })
    ).catch(async (error: Error) => {
        console.error("createPaymentMethods", error);
        return change.ref.update({
            error: {
                name: error.name,
                message: error.message,
            }
        })
    })
})

exports.delete = ref.onDelete((change)=>{
    const data = change.data() as PaymentMethod
    if (!data.stripePayment) return
    const stripe = new Stripe(stripeSecret, {apiVersion: "2022-11-15"});
    return stripe.paymentMethods.detach(data.stripePayment, {
        idempotencyKey: `payment_detach_${change.id}`
    })
})
