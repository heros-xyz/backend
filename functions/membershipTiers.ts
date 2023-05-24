import * as functions from "firebase-functions";
import Stripe from "stripe";

const stripeKey = functions.params.defineSecret("STRIPE_KEY");

export interface MembershipTier {
    id?: string
    name: string
    type: "GOLD"|"BRONZE"
    tierDescription: string
    monthlyPrice: number
    stripePrice?: string|false
    stripeProduct?: string|false
    benefits: string[]
    totalFan?: number
    uid: string
}

const baseRef = functions.runWith({
    secrets: [stripeKey]
}).firestore.document("membershipTiers/{docId}")

exports.create = baseRef.onCreate(async (change) => {
    const data = change.data() as MembershipTier
    let product: Stripe.Response<Stripe.Product>|undefined
    let price: Stripe.Response<Stripe.Price>|undefined
    try {
        const stripe = new Stripe(stripeKey.value(), {apiVersion: "2022-11-15"});
        product = await stripe.products.create({
            id: change.id,
            name: `${data.type}_${data.uid}`,
            metadata: {
                maker: data.uid,
                type: data.type
            }
        })
        price = await stripe.prices.create({
            product: product.id,
            currency: "USD",
            recurring: {
                interval: "month"
            },
            unit_amount: Math.round(data.monthlyPrice * 100),
        })
    } catch (e) {
        console.error("createMembershipTiers", e)
    }
    await change.ref.update({
        stripeProduct: product?.id,
        stripePrice: price?.id,
    })
})

exports.update = baseRef.onUpdate(async (change) => {
    const dataBefore =  change.before.data() as MembershipTier
    const dataAfter =  change.after.data() as MembershipTier
    if (!dataAfter.stripeProduct) return
    if (dataAfter.monthlyPrice === dataBefore.monthlyPrice) return
    let price: Stripe.Response<Stripe.Price>|undefined
    try {
        const stripe = new Stripe(stripeKey.value(), {apiVersion: "2022-11-15"});
        await stripe.prices.update(dataBefore.stripePrice as string,{
            active: false,
        })
        price = await stripe.prices.create({
            product: dataAfter.stripeProduct,
            currency: "USD",
            recurring: {
                interval: "month"
            },
            unit_amount: Math.round(dataAfter.monthlyPrice * 100),
        })
    } catch (e) {
        console.error("updateMembershipTiers", e)
    }
    await change.after.ref.update({
        stripePrice: price?.id || false,
    })

});

exports.delete = baseRef.onDelete(async (change) => {
    const data =  change.data() as MembershipTier
    if(!data.stripeProduct) return
    const stripe = new Stripe(stripeKey.value(), {apiVersion: "2022-11-15"});
    try {
        await stripe.prices.update(data.stripePrice as string,{
            active: false,
        })
        await stripe.products.update(data.stripeProduct, {
            active: false
        })
    } catch (e) {
        console.error(`deleteMembershipTiers ${data.stripeProduct} - ${data.stripePrice}`, e)
    }

})
