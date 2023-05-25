import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

export interface WithdrawalRequest {
  bankName: string;
  cardNumber: string;
  swiftCode: string;
  uid: string;
}

const refWithdrawal = functions.firestore.document(
  "withdrawalRequests/{docId}"
);

exports.onWithdrawalRequest = refWithdrawal.onCreate(async (changed) => {
  const changedData = changed.data() as WithdrawalRequest;
  try {
    if (!changedData?.uid) {
      throw new Error("[onWithdrawalRequest] No uid");
    }
    const userRef = admin.firestore().collection("user").doc(changedData.uid);
    const user = await userRef.get();
    if (user?.exists) {
      await userRef.set({ netAmount: "" }, { merge: true });
    }
  } catch (error) {
    functions.logger.error(error);
  }
});
