import * as admin from "firebase-admin";
import { CollectionPath } from "./types";
import { Post } from "./notifications";

const converter = {
  toFirestore: (data: any) => data,
  fromFirestore: (snap: admin.firestore.QueryDocumentSnapshot) => {
    const data = snap.data();
    data.id = snap.id;
    return data;
  },
};

export async function getPost(id: string): Promise<Post | null> {
  try {
    const post = await admin
      .firestore()
      .collection(CollectionPath.POSTS)
      .doc(id)
      .withConverter(converter)
      .get();
    if (post.exists) return post.data() as Post;
    else throw new Error("Post not found");
  } catch (error) {
    console.log(error);
  }
  return null;
}
