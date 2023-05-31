import * as admin from "firebase-admin";
// eslint-disable-next-line import/no-unresolved
import * as functions from "firebase-functions/v2";
import { CollectionPath, WithdrawalRequest, OperationStatus, User } from "./types";

exports.create = functions.https.onCall<WithdrawalRequest>((request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  const userRef = admin.firestore().collection(CollectionPath.user).doc(uid);
  const withdrawalRef = admin.firestore().collection(CollectionPath.withdrawal).doc();


  return admin.firestore().runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new Error("User does not exist");
      }
      const user = userDoc.data() as User;
      transaction.update(userRef, { netAmount: 0 });
      transaction.set(withdrawalRef, {
        uid: uid,
        amount: user.netAmount,
        status: OperationStatus.pending,
      });
    }).catch((error) => {
      console.error(error);
      throw new functions.https.HttpsError("aborted", "create withdrawal failed");
    }).then(() => withdrawalRef.id);
});
