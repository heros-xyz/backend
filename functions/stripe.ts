import BigNumber from "bignumber.js";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import Stripe from "stripe";
import { HEROS_PLATFORM_FEE } from "./constants/subscription";

export enum SubscriptionStatus {
  DRAFT = 0,
  ACTIVE = 1,
  EXPIRED = 2,
  CANCEL = 3,
}

function getSubscriptionId(data: Stripe.Invoice) {
  let subscriptionId;

  for (const invoiceLineItem of data.lines.data) {
    if (invoiceLineItem.metadata.subscriptionId) {
      subscriptionId = invoiceLineItem.metadata.subscriptionId;
      break;
    }
  }

  return subscriptionId;
}

async function updateFans(atlheteId: string) {
  const fansCount = await admin
    .firestore()
    .collection("subscriptions")
    .where("maker", "==", atlheteId)
    .where("status", "==", SubscriptionStatus.ACTIVE)
    .get();
  //update Athlete
  await admin.firestore().collection("athleteProfile").doc(atlheteId).update({
    totalSubCount: fansCount.docs.length,
  });
  //totalSubCount
}

const events = {
  "invoice.created": async (event: Stripe.Event) => {
    const data = event.data.object as Stripe.Invoice;
    const userDocs = await admin
      .firestore()
      .collection("user")
      .where("stripeCustomer", "==", data.customer)
      .get();
    const userDoc = userDocs.docs[0];
    if (!userDoc) {
      console.error("created-Unknown customer", data);
      return;
    }
    if (data.billing_reason === "subscription_create") {
      const subscriptionId = getSubscriptionId(data);
      if (!subscriptionId) {
        console.error("created-Unknown subscription", data);
        return;
      }
      await admin
        .firestore()
        .collection("subscriptions")
        .doc(subscriptionId)
        .update({
          status: SubscriptionStatus.ACTIVE,
        });
      await updateFans(subscriptionId.split("_")[1]);
    }
    return admin
      .firestore()
      .collection("invoices")
      .doc(data.id)
      .set({
        ...data,
        uid: userDoc.id,
      });
  },
  "invoice.payment_succeeded": async (event: Stripe.Event) => {
    const data = event.data.object as Stripe.Invoice;
    const invoice = await admin
      .firestore()
      .collection("invoices")
      .doc(data.id)
      .get();
    if (!invoice.exists)
      console.error("payment_succeeded - Unknown invoice", data);
    const subscriptionId = getSubscriptionId(data);
    const maker = subscriptionId?.split?.("_")[1];
    const makerRef = await admin.firestore().doc(`user/${maker}`).get();
    const makerData = makerRef?.data();
    const currentAmount = makerData?.netAmount ?? 0;
    const price = new BigNumber(invoice?.data?.()?.amount_paid);
    const addAmount = price
      .multipliedBy(new BigNumber(100).minus(new BigNumber(HEROS_PLATFORM_FEE)))
      .dividedBy(100);
    const currentAmountBig = new BigNumber(currentAmount);
    const newNetAmount = currentAmountBig.plus(addAmount).toString();

    const invoiceDocRef = admin.firestore().collection("invoices").doc(data.id);

    return await admin.firestore().runTransaction(async (txn) => {
      return txn
        .update(makerRef.ref, { netAmount: newNetAmount })
        .set(invoiceDocRef, { ...data }, { merge: true });
    });
  },
  "invoice.payment_failed": async (event: Stripe.Event.Data) => {
    const data = event.object as Stripe.Invoice;
    const invoice = await admin
      .firestore()
      .collection("invoices")
      .doc(data.id)
      .get();
    if (!invoice.exists)
      console.error("payment_succeeded - Unknown invoice", data);
    await admin
      .firestore()
      .collection("invoices")
      .doc(data.id)
      .set(
        {
          ...data,
        },
        { merge: true }
      );

    const subscriptionId = getSubscriptionId(data);
    if (!subscriptionId) {
      console.error("payment_failed-Unknown subscription", data);
      return;
    }
    await admin
      .firestore()
      .collection("subscriptions")
      .doc(subscriptionId)
      .update({
        status: SubscriptionStatus.CANCEL,
      });
    await updateFans(subscriptionId.split("_")[1]);
  },
  "customer.subscription.updated": async (event: Stripe.Event.Data) => {
    const data = event.object as Stripe.Subscription;
    functions.logger.log("customer.subscription.updated", data);
    const subscriptionId = data.metadata.subscriptionId;
    if (!subscriptionId) {
      console.error("customer.subscription.updated subscription", data);
      return;
    }
    await admin
      .firestore()
      .collection("subscriptions")
      .doc(subscriptionId)
      .update({
        stripeSubscription: data,
      });
  },
  "customer.subscription.deleted": async (event: Stripe.Event) => {
    const data = event.data as any;
    const metadata = data.object?.metadata;
    const subscriptionId = metadata?.subscriptionId as string;
    if (!subscriptionId) {
      console.error("customer.subscription.deleted subscription", data);
      return;
    }
    await admin
      .firestore()
      .collection("subscriptions")
      .doc(subscriptionId)
      .update({
        autoRenew: false,
        status: SubscriptionStatus.CANCEL,
      });
    await updateFans(subscriptionId.split("_")[1]);
  },
  /*"invoice.finalized",
    "invoice.finalization_failed",
    "invoice.paid"*/
};

const stripeSecret =
  "sk_test_51N3iHSIaE495kvrkHHOlGMunzqORnjPCBQImK4D4PccKWmG05QtvdlZleNEi7aS95IodbtAPvjm7LCVNF3EnFymz002NyQmytw";
const stripeEndpointSecret =
  "whsec_9b879f3bf39c19e7f9cdf733cb84ae7364d3687c3d2b781694d9b32b82b8b475";
export const webhook = functions.https.onRequest((req, res) => {
  const stripe = new Stripe(stripeSecret, { apiVersion: "2022-11-15" });
  const sig = req.headers["stripe-signature"];
  if (!sig) {
    res.json({ received: true });
    return;
  }
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig || "",
      stripeEndpointSecret
    );
  } catch (err: any) {
    console.error("Error processing event", err);
    res.status(400).send();
    return;
  }

  if (Object.keys(events).includes(event.type)) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const call = events[event.type](event) as Promise<void>;
    call.then(() => res.json({ received: true }));
  } else {
    console.log("Unexpected event", event.type);
    res.json({ received: true });
  }
});
