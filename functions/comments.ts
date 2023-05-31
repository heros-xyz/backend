import * as functions from "firebase-functions";
// eslint-disable-next-line import/no-unresolved
import * as functions2 from "firebase-functions/v2";
import * as admin from "firebase-admin";
// eslint-disable-next-line import/no-unresolved
import {Timestamp} from "firebase-admin/firestore";
import {
    AthleteProfile,
    CollectionPath,
    Comment,
    CommentRequest,
    FanProfile,
} from "./types";

const refComments = functions.firestore.document("comments/{docId}");

async function updateCommentsCount(postId: string) {
  const comments = await admin
    .firestore()
    .collection(CollectionPath.comments)
    .where("post", "==", postId)
    .get();
  console.log({ postId, c: comments.docs })
  await admin.firestore().collection("post").doc(postId).update({
    commentsCount: comments.docs.length,
  });
}

exports.onChange = refComments.onUpdate(async (change) => {
    const comment = change.after.data() as Comment
    if (!comment.deletedAt) return;
    await updateCommentsCount(comment.post)
})

exports.create = functions2.https.onCall<CommentRequest>(async request=>{
  if (!request.auth?.uid) return
  const {post, content, parent} = request.data;
  let authorProfile: FanProfile | AthleteProfile
  let authorProfileCollection: CollectionPath
  let  doc = await admin.firestore().collection(CollectionPath.fanProfile).doc(request.auth.uid).get()
    if(doc.exists){
        authorProfile = doc.data() as FanProfile
        authorProfileCollection = CollectionPath.fanProfile
    }
    else{
        doc = await admin.firestore().collection(CollectionPath.athleteProfile).doc(request.auth.uid).get()
        if(!doc.exists){
            throw new functions.https.HttpsError("not-found", "User profile not found")
        }
        authorProfile = doc.data() as AthleteProfile
        authorProfileCollection = CollectionPath.athleteProfile
    }

  const comment: Comment = {
      post,
      content,
      parent,
      createdAt: Timestamp.now(),
      authorProfile,
      authorProfileCollection,
      author: request.auth.uid,
      commentsCount: 0,
      reactionsCount: 0,
  }
  if (!comment.parent)
      delete comment.parent
  await admin.firestore().collection("comments").add(comment)
  return updateCommentsCount(post)
})
