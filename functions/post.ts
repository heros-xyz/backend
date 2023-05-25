import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { Post } from "./notifications";
import { AthleteProfile } from "./auth";

const refPosts = functions.firestore.document("post/{docId}");

exports.onNewPost = refPosts.onCreate(async (post) => {
  const changedData = post.data() as Post;

  try {
    if (!changedData?.uid) {
      throw new Error("[onNewPost] No uid");
    }
    const athleteProfileRef = admin
      .firestore()
      .collection("athleteProfile")
      .doc(changedData.uid);
    const athlete = await athleteProfileRef.get();
    if (athlete?.exists) {
      functions.logger.log("athlete exists", changedData);
      const currentDates = [
        ...(athlete.data()?.postsDates ?? []),
        {
          id: post.id,
          date: changedData.publicDate,
        },
      ];
      await athleteProfileRef.set(
        { postsDates: currentDates },
        { merge: true }
      );
    }
  } catch (error) {
    functions.logger.error(error);
  }
});

exports.onDeletePost = refPosts.onDelete(async (post) => {
  const changedData = post.data() as Post;

  try {
    if (!changedData?.uid) {
      throw new Error("[onDeletePost] No uid");
    }

    const athleteProfileRef = admin
      .firestore()
      .collection("athleteProfile")
      .doc(changedData.uid);
    const athlete = await athleteProfileRef.get();

    if (athlete?.exists) {
      const athleteData = athlete?.data() as AthleteProfile;
      const currentDates = athleteData.postsDates.filter(
        (date) => date.id !== post.id
      );

      await athleteProfileRef.set(
        { postsDates: currentDates },
        { merge: true }
      );
    }
  } catch (error) {
    console.log(error);
  }
});
