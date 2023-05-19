import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import Stripe from "stripe";
import { PaymentMethod } from "./paymentMethod";
import { User } from "./auth";
import { MembershipTier } from "./membershipTiers";

export enum SubscriptionStatus {
  DRAFT = 0,
  ACTIVE = 1,
  EXPIRED = 2,
  CANCEL = 3,
}

interface SuscriptionCreateParams {
  paymentMethod: string;
  membershipTier: string;
}

export interface SuscriptionDoc {
  stripeSubscription: Stripe.Response<Stripe.Subscription>;
  maker: string;
  taker: string;
  status: SubscriptionStatus;
  takerData: {
    avatar: string;
    name: string;
    email: string;
  };
  createdAt: Date;
}

const stripeSecret =
  "sk_test_51N3iHSIaE495kvrkHHOlGMunzqORnjPCBQImK4D4PccKWmG05QtvdlZleNEi7aS95IodbtAPvjm7LCVNF3EnFymz002NyQmytw";
exports.create = functions.https.onCall(
  async (
    { paymentMethod, membershipTier }: SuscriptionCreateParams,
    context
  ) => {
    functions.logger.log("START create subscription", {
      paymentMethod,
      membershipTier,
    });
    const uid = context.auth?.uid;
    if (!uid) throw new functions.https.HttpsError("permission-denied", "uid");

    const paymentMethodDoc = await admin
      .firestore()
      .doc(`paymentMethods/${paymentMethod}`)
      .get();
    const paymentMethodDocData = paymentMethodDoc.data() as PaymentMethod;
    if (!paymentMethodDocData || paymentMethodDocData.uid !== uid)
      throw new functions.https.HttpsError(
        "permission-denied",
        "paymentMethod"
      );

    const userDoc = await admin.firestore().doc(`user/${uid}`).get();
    const userDocData = userDoc.data() as User;
    functions.logger.info("userDocData", userDocData);
    if (!userDocData || !userDocData.stripeCustomer)
      throw new functions.https.HttpsError("permission-denied", "customer");

    const membershipTierDoc = await admin
      .firestore()
      .doc(`membershipTiers/${membershipTier}`)
      .get();
    const membershipTierData = membershipTierDoc.data() as MembershipTier;
    if (!membershipTierData || !membershipTierData.stripeProduct)
      throw new functions.https.HttpsError("permission-denied", "product");

    const stripe = new Stripe(stripeSecret, { apiVersion: "2022-11-15" });

    const suscriptionDoc = await admin
      .firestore()
      .collection("subscriptions")
      .doc(`${uid}_${membershipTierData.uid}`)
      .get();
    const suscriptionDocData = suscriptionDoc.data() as SuscriptionDoc;
    if (
      suscriptionDocData &&
      (suscriptionDocData.stripeSubscription as Stripe.Response<Stripe.Subscription>)
    ) {
      await stripe.subscriptions.del(suscriptionDocData.stripeSubscription.id);
    }

    const suscription = await stripe.subscriptions.create({
      customer: userDocData.stripeCustomer,
      items: [
        {
          price: membershipTierData.stripePrice as string,
          quantity: 1,
        },
      ],
      default_payment_method: paymentMethodDocData.stripePayment.id,
      metadata: {
        subscriptionId: suscriptionDoc.id,
      },
    });

 const makerDoc = await admin
   .firestore()
   .doc(`athleteProfile/${membershipTierData.uid}`)
   .get();
 const makerDocData = makerDoc.data();

 return suscriptionDoc.ref.set(
   {
     stripeSubscription: suscription,
     maker: membershipTierData.uid,
     taker: uid,
     createdAt: new Date(),
     expiredDate: suscription.current_period_end,
     makerData: {
       avatar: makerDocData?.avatar,
       nickName: makerDocData?.nickName,
       fullName:
         makerDocData?.fullName ??
         `${makerDocData?.firstName} ${makerDocData?.lastName ?? ""}`,
     },
     monthlyPrice: membershipTierData.monthlyPrice,
     takerData: {
       avatar: userDocData?.avatar,
       email: userDocData?.email,
       name:
         userDocData?.fullName ??
         `${userDocData?.firstName} ${userDocData?.lastName}`,
     },
     status: SubscriptionStatus.DRAFT,
   } as SuscriptionDoc,
   { merge: true }
 );
  }
);
