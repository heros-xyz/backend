import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const refComments = functions.firestore.document("comments/{docId}");

async function updateCommentsCount(postId: string) {
  const comments = await admin
    .firestore()
    .collection("comments")
    .where("post", "==", postId)
    .get();
  await admin.firestore().collection("post").doc(postId).update({
    commentsCount: comments.docs.length,
  });
}

exports.onCreate = refComments.onCreate(async (change) => {
  const { post } = change.data();
  await updateCommentsCount(post);
});
