import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

export enum NotificationEventType {
  FAN_SUBSCRIBE_ATHLETE = "F_SUBSCRIBE", // A fan subscribes to an athlete's tier
  FAN_LIKE_INTERACTION = "F_LIKE_INTERACTION", // A fan likes an athlete's interactions
  FAN_COMMENT_INTERACTION = "F_COMMENT_INTERACTION", // A fan comments on an athlete's interaction
  FAN_LIKE_COMMENT = "F_LIKE_COMMENT", // A fan likes an athlete's comment & A fan likes a comment's reply.
  FAN_REPLY_COMMENT = "F_REPLY_COMMENT", // A fan replies to an athlete's comment
  FAN_LIKE_REPLY = "F_LIKE_REPLY", // A fan replies to an athlete's comment

  ATHLETE_NEW_INTERACTION = "A_NEW_INTERACTION", // An athlete posts a new interaction
  ATHLETE_LIKE_INTERACTION = "A_LIKE_INTERACTION", // TODO: An athlete like an interaction
  ATHLETE_COMMENT_INTERACTION = "A_COMMENT_INTERACTION", // An athlete comments an interaction
  ATHLETE_LIKE_COMMENT = "A_LIKE_COMMENT", // An athlete likes fan's comment
  ATHLETE_REPLY_COMMENT = "A_REPLY_COMMENT", // An athlete replies to fan's comment
  ATHLETE_LIKE_REPLY = "A_LIKE_REPLY", // An athlete likes fan's comment's reply

  FAN_LIKE_FAN_COMMENT = "F_LIKE_F_COMMENT", // Another fan likes fan's comment
  FAN_REPLY_FAN_COMMENT = "F_REPLY_F_COMMENT", // Another fan replies to fan's comment
  FAN_LIKE_FAN_REPLY = "F_LIKE_F_REPLY", // Another fan likes fan's comment's reply
}

export enum NotificationStatusType {
  ALL = "ALL",
  READ = "READ",
  NOT_READ = "NOT_READ",
}

interface Notification {
  createdAt: Date;
  deletedAt?: Date;
  readAt: Date | null;
  type: "comment" | "like" | "subscription" | "post";
  eventType: NotificationEventType;
  status: NotificationStatusType;
  message?: string;
  params?: any;
  uid?: string;
  to: string; // id to get the post comment or tier
}

const refPost = functions.firestore.document("post/{docId}");

exports.create = refPost.onCreate(async (change) => {
  const onCreateData = change.data();
  const onCreateId = change.id;

  functions.logger.log("Hello from info. Here's an object:", onCreateData);

  console.log("star", { onCreateData, onCreateId });
  try {
    // create a notification doc
    const params: Notification = {
      createdAt: new Date(),
      readAt: null,
      type: "post",
      to: onCreateId,
      status: NotificationStatusType.NOT_READ, // TODO: check this
      eventType: NotificationEventType.ATHLETE_NEW_INTERACTION,
    };
    console.log("creando");
    await admin.firestore().collection("notification").add(params);
  } catch (error) {
    console.log(error);
  }
});

exports.update = refPost.onUpdate(async (change) => {
  const onUpdateData = change.after.data();
  console.log("update", onUpdateData);
});
