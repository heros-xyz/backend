import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {CollectionPath} from "./types";

const refReactions = functions.firestore.document("reactions/{docId}");

async function updateReactionsCount(to: string, toType: CollectionPath) {
    const reactions = await admin.firestore().collection("reactions")
        .where("to", "==", to)
        .get()
    console.log({to, toType})
    await admin.firestore().collection(toType).doc(to).update({
        reactionsCount: reactions.docs.length
    })
}

exports.onCreate = refReactions.onCreate(async (change) => {
    const {to, toType} = change.data();
    await updateReactionsCount(to, toType);
})

exports.onDelete = refReactions.onDelete(async (change) => {
    const {to, toType} = change.data();
    await updateReactionsCount(to, toType);
})
