import * as functions from "firebase-functions";
import Stripe from "stripe";

const stripeSecret  = "sk_test_51N3iHSIaE495kvrkHHOlGMunzqORnjPCBQImK4D4PccKWmG05QtvdlZleNEi7aS95IodbtAPvjm7LCVNF3EnFymz002NyQmytw"

export interface MembershipTier {
    id?: string
    name: string
    type: "GOLD"|"BRONZE"
    tierDescription: string
    monthlyPrice: number
    stripePrice: string
    stripeProduct: string
    benefits: string[]
    totalFan?: number
    uid: string
}

exports.createMembershipTiers = functions.firestore.document("membershipTiers/{docId}").onCreate(async (change) => {
    const stripe = new Stripe(stripeSecret, {apiVersion: "2022-11-15"});
    const data = change.data() as MembershipTier
    const product = await stripe.products.create({
        id: change.id,
        name: `${data.type}_${data.uid}`,
        metadata: {
            maker: data.uid,
            type: data.type
        }
    })
    const price = await stripe.prices.create({
        product: product.id,
        currency: "USD",
        recurring: {
            interval: "month"
        },
        unit_amount: Math.round(data.monthlyPrice * 100),
    })
    await change.ref.update({
        stripeProduct: product.id,
        stripePrice: price.id,
    })
})

exports.updateMembershipTiers = functions.firestore.document("membershipTiers/{docId}").onUpdate(async (change) => {
    const stripe = new Stripe(stripeSecret, {apiVersion: "2022-11-15"});
    const dataBefore =  change.before.data() as MembershipTier
    const dataAfter =  change.after.data() as MembershipTier
    if (dataAfter.monthlyPrice !== dataBefore.monthlyPrice) {
        await stripe.prices.update(dataBefore.stripePrice as string,{
            active: false,
        })
        const price = await stripe.prices.create({
            product: dataAfter.stripeProduct,
            currency: "USD",
            recurring: {
                interval: "month"
            },
            unit_amount: Math.round(dataAfter.monthlyPrice * 100),
        })
        await change.after.ref.update({
            stripePrice: price.id,
        })
    }
});

exports.deleteMembershipTiers = functions.firestore.document("membershipTiers/{docId}").onDelete(async (change, context) => {
    const stripe = new Stripe(stripeSecret, {apiVersion: "2022-11-15"});
    const data =  change.data() as MembershipTier
    await stripe.prices.update(data.stripePrice as string,{
        active: false,
    })
    await stripe.products.update(data.stripeProduct, {
        active: false
    })
})
