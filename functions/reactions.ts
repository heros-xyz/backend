import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const refReactions = functions.firestore.document("reactions/{docId}");

async function updateReactionsCount(to: string, toType: string) {
    const reactions = await admin.firestore().collection("reactions")
        .where("to", "==", to)
        .get()
    await admin.firestore().collection(toType.toLowerCase()).doc(to).update({
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
