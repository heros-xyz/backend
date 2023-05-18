import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { User } from "./auth";
import { SubscriptionStatus, SuscriptionDoc } from "./subscriptions";

export enum NotificationEventType {
  FAN_SUBSCRIBE_ATHLETE = "F_SUBSCRIBE", // A fan subscribes to an athlete's tier
  FAN_LIKE_INTERACTION = "F_LIKE_INTERACTION", // A fan likes an athlete's interactions
  FAN_COMMENT_INTERACTION = "F_COMMENT_INTERACTION", // A fan comments on an athlete's interaction
  FAN_LIKE_COMMENT = "F_LIKE_COMMENT", // A fan likes an athlete's comment & A fan likes a comment's reply.
  FAN_REPLY_COMMENT = "F_REPLY_COMMENT", // A fan replies to an athlete's comment
  FAN_LIKE_REPLY = "F_LIKE_REPLY", // A fan replies to an athlete's comment

  ATHLETE_NEW_INTERACTION = "A_NEW_INTERACTION", // An athlete posts a new interaction X
  ATHLETE_LIKE_INTERACTION = "A_LIKE_INTERACTION", // TODO: An athlete like an interaction X
  ATHLETE_COMMENT_INTERACTION = "A_COMMENT_INTERACTION", // An athlete comments an interaction X
  ATHLETE_LIKE_COMMENT = "A_LIKE_COMMENT", // An athlete likes fan's comment X
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

export interface Post {
  id?: string;
  content: string;
  publicDate: Date | string;
  schedule?: boolean;
  publicType: string;
  tags: string[];
  media: {
    url: string;
    type: string;
  }[];
  reactionCount?: number;
  commentCount?: number;
  totalCommentCount: number;
  totalReactionsCount: number;
  liked?: boolean;
  uid?: string;
  createdAt: Date;
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
  targetUser: string; // query notification to user in frontend
}

const converter = {
  toFirestore: (data: any) => data,
  fromFirestore: (snap: admin.firestore.QueryDocumentSnapshot) => {
    const data = snap.data();
    data.id = snap.id;
    return data;
  },
};

const refPost = functions.firestore.document("post/{docId}");

exports.onPostCreate = refPost.onCreate(async (change) => {
  const onCreateData = change.data();
  const onCreateId = change.id;

  functions.logger.log("onPostUpdate", onCreateData);

  try {
    const params: Notification = {
      createdAt: new Date(),
      readAt: null,
      type: "like",
      to: onCreateId,
      status: NotificationStatusType.NOT_READ, // TODO: check this
      eventType: NotificationEventType.ATHLETE_LIKE_INTERACTION,
    };
    await admin.firestore().collection("notification").add(params);
  } catch (error) {
    functions.logger.error("[ERROR] onPostUpdate", error);
  }
});

export type ReactionType = "LIKE";
export type ToType = "POST" | "COMMENT";
export interface Reaction {
  id?: string;
  type_: ReactionType;
  toType: ToType;
  to: string; // puede ser un post o comentario
  uid: string; // la persona que lo origino
}

const refReactions = functions.firestore.document("reactions/{docId}");

exports.onReactionCreate = refReactions.onCreate(async (change) => {
  const onCreateData = change.data() as Reaction;
  const onCreateId = change.id;

  functions.logger.log("onReactionCreate", onCreateData);

  try {
    const userMaker = (
      await admin.firestore().doc(`user/${onCreateData.uid}`).get()
    ).data() as User;

    let params: Notification = {};

    // TODO: maybe switch statement?
    if (onCreateData.toType === "POST") {
      // ATHLETE_LIKE_INTERACTION = "A_LIKE_INTERACTION", // TODO: An athlete like an interaction
      const post = (
        await admin.firestore().doc(`post/${onCreateData.to}`).get()
      ).data() as Post;

      // the user that create the post
      const targetUserId = (
        await admin.firestore().doc(`user/${post.uid}`).get()
      ).id;

      if (userMaker?.profileType === "ATHLETE") {
        params = {
          createdAt: new Date(),
          readAt: null,
          type: "post",
          to: onCreateId,
          targetUser: targetUserId,
          message: "notification.from-athlete.like.interaction",
          status: NotificationStatusType.NOT_READ, // TODO: check this
          eventType: NotificationEventType.ATHLETE_LIKE_INTERACTION,
        };
      }
    }

    if (onCreateData.toType === "COMMENT") {
      //ATHLETE_LIKE_COMMENT = "A_LIKE_COMMENT", // An athlete likes fan's comment
      const comment = (
        await admin.firestore().doc(`comments/${onCreateData.to}`).get()
      ).data() as Comment;

      const commentMaker = (
        await admin
          .firestore()
          .doc(`user/${comment.uid}`)
          .withConverter(converter)
          .get()
      ).data() as User;

      if (
        userMaker.profileType === "ATHLETE" &&
        commentMaker.profileType === "FAN"
      ) {
        params = {
          createdAt: new Date(),
          readAt: null,
          type: "like",
          to: comment.post, // POST
          targetUser: commentMaker.id,
          status: NotificationStatusType.NOT_READ, // TODO: check this
          eventType: NotificationEventType.ATHLETE_LIKE_COMMENT,
        };
      }
    }

    await admin.firestore().collection("notification").add(params);
  } catch (error) {
    functions.logger.error("[ERROR] onReactionCreate", error);
  }
});

export interface Comment {
  id?: string;
  createdAt: Date;
  deletedAt: Date;
  content: string;
  post: string;
  uid: string;
  parent?: string;
  //calcular
  isLiked?: boolean;
  likeCount?: number;
  commentsCount?: number;
  isAuthorComment?: boolean;
}

const refComments = functions.firestore.document("comments/{docId}");

exports.onCommentCreate = refComments.onCreate(async (change) => {
  const onCreateData = change.data() as Comment;
  const onCreateId = change.id;

  functions.logger.log("onCommentCreate", onCreateData);

  try {
    const userMaker = (
      await admin.firestore().doc(`user/${onCreateData.uid}`).get()
    ).data() as User;

    let params: Notification = {};

    // TODO: maybe switch statement?
    if (userMaker?.profileType === "ATHLETE") {
      const isReply = !!onCreateData.parent;
      if (isReply) {
        const parentComment = (
          await admin.firestore().doc(`comments/${onCreateData.parent}`).get()
        ).data() as Comment;

        const parentCommentMaker = (
          await admin
            .firestore()
            .doc(`user/${parentComment.uid}`)
            .withConverter(converter)
            .get()
        ).data() as User;

        if (parentCommentMaker.profileType === "FAN") {
          // ATHLETE_REPLY_COMMENT = "A_REPLY_COMMENT", // An athlete replies to fan's comment
          params = {
            createdAt: new Date(),
            readAt: null,
            type: "comment",
            targetUser: parentCommentMaker.id,
            to: onCreateData.post, // this should be the post
            status: NotificationStatusType.NOT_READ, // TODO: check this
            eventType: NotificationEventType.ATHLETE_REPLY_COMMENT,
          };
        }
      }

      const post = (
        await admin.firestore().doc(`post/${onCreateData.post}`).get()
      ).data() as Post;

      const postMaker = (
        await admin
          .firestore()
          .doc(`user/${post.uid}`)
          .withConverter(converter)
          .get()
      ).data() as User;

      // ATHLETE_COMMENT_INTERACTION = "A_COMMENT_INTERACTION", // An athlete comments an interaction
      params = {
        createdAt: new Date(),
        readAt: null,
        type: "comment",
        targetUser: postMaker.id,
        to: onCreateData.post, // this should be the post
        status: NotificationStatusType.NOT_READ, // TODO: check this
        eventType: NotificationEventType.ATHLETE_COMMENT_INTERACTION,
      };

      await admin.firestore().collection("notification").add(params);
    }
  } catch (error) {
    functions.logger.error("[ERROR] onCommentCreate", error);
  }
});

const refSubscriptions = functions.firestore.document("subscriptions/{docId}");

exports.onSubscriptionUpdate = refSubscriptions.onUpdate(async (change) => {
  const afterData = change.after.data() as SuscriptionDoc;
  const afterDataId = change.after.id;

  if (afterData.status === SubscriptionStatus?.ACTIVE) {
    const params = {
      createdAt: new Date(),
      readAt: null,
      type: "subscription",
      targetUser: afterData?.maker,
      to: afterDataId,
      status: NotificationStatusType.NOT_READ,
      eventType: NotificationEventType.FAN_SUBSCRIBE_ATHLETE,
    };

    await admin.firestore().collection("notification").add(params);
  }
});