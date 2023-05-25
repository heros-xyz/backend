import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { User } from "./auth";
import { SubscriptionStatus, SubscriptionDoc } from "./subscriptions";

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

export interface IComment {
  id: string;
  content: string;
  userId: string;
  createdAt: string | Date;
}

export interface IInteraction {
  id: string;
  content: string;
}

interface Notification {
  createdAt: Date;
  deletedAt?: Date;
  readAt: Date | null;
  type: "comment" | "like" | "subscription" | "post";
  eventType: NotificationEventType;
  status: NotificationStatusType;
  message?: string;
  params?: {
    interaction?: IInteraction;
    comment?: IComment;
  };
  source?: {
    // the user that trigger the notification
    avatar: string | null;
    fullName: string | null;
    nickName: string | null;
    id: string;
  };
  to: string; // id to get the post comment or tier
  uid?: string;
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
    // buscar todas las suscripciones activas de este atleta
    const activeSubscriptions = (
      await admin
        .firestore()
        .collection("subscriptions")
        .where("maker", "==", onCreateData.uid)
        .where("status", "==", SubscriptionStatus.ACTIVE)
        .get()
    ).docs.map((doc) => doc.data() as SubscriptionDoc);

    const makerDoc = (
      await admin.firestore().doc(`athleteProfile/${onCreateData.uid}`).get()
    ).data();
    const params: Notification = {
      createdAt: new Date(),
      readAt: null,
      type: "post",
      to: onCreateId,
      params: {
        interaction: {
          id: onCreateId,
          content: onCreateData.content,
        },
      },
      source: {
        id: onCreateData.uid,
        avatar: makerDoc?.avatar,
        fullName: makerDoc?.fullName,
        nickName: makerDoc?.nickName,
      },
      uid: onCreateData.uid,
      status: NotificationStatusType.NOT_READ, // TODO: check this
      eventType: NotificationEventType.ATHLETE_NEW_INTERACTION,
    };

    for (const subscription of activeSubscriptions) {
      params.uid = subscription.taker;
      await admin.firestore().collection("notification").add(params);
    }

    const makerRef = admin
      .firestore()
      .doc(`athleteProfile/${onCreateData.uid}`);
    const makerRefData = (await makerRef.get()).data();
    const count = (makerRefData?.totalInteractionCount ?? 0) + 1;
    await makerRef.update({ totalInteractionCount: count });
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

    let params: Notification | null = null;

    // TODO: maybe switch statement?
    if (onCreateData.toType === "POST") {
      // ATHLETE_LIKE_INTERACTION = "A_LIKE_INTERACTION", // TODO: An athlete like an interaction
      const post = (
        await admin.firestore().doc(`post/${onCreateData.to}`).get()
      ).data() as Post;

      // FAN_LIKE_INTERACTION = "F_LIKE_INTERACTION", // A fan likes an athlete's interactions
      if (userMaker?.profileType === "FAN" && onCreateData.type_ === "LIKE") {
        params = {
          createdAt: new Date(),
          eventType: NotificationEventType.FAN_LIKE_INTERACTION,
          readAt: null,
          type: "post",
          status: NotificationStatusType.NOT_READ,
          uid: post.uid,
          to: onCreateId,
          source: {
            avatar: userMaker.avatar || null,
            fullName: userMaker?.fullName || userMaker?.nickName || null,
            id: onCreateData.uid,
            nickName: userMaker?.nickName || null,
          },
          params: {
            interaction: {
              id: onCreateData?.to,
              content: post?.content ?? "",
            },
          },
        };

        return await admin.firestore().collection("notification").add(params);
      }
    }

    if (onCreateData.toType === "COMMENT" && onCreateData.type_ === "LIKE") {
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
          uid: commentMaker.uid,
          status: NotificationStatusType.NOT_READ, // TODO: check this
          eventType: NotificationEventType.ATHLETE_LIKE_COMMENT,
          source: {
            avatar: userMaker.avatar || null,
            fullName: userMaker?.fullName || userMaker?.nickName || null,
            id: onCreateData.uid,
            nickName: userMaker?.nickName || null,
          },
        };
      }
    }

    if (params) await admin.firestore().collection("notification").add(params);
  } catch (error) {
    functions.logger.error("[ERROR] onReactionCreate", error);
  }
  return
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

  functions.logger.log("onCommentCreate", onCreateData);

  try {
    const userMaker = (
      await admin.firestore().doc(`user/${onCreateData.uid}`).get()
    ).data() as User;

    let params: Notification;

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
            uid: parentCommentMaker.uid,
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
        uid: postMaker.uid,
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
  const afterData = change.after.data() as SubscriptionDoc;
  const afterDataId = change.after.id;

  if (afterData.status === SubscriptionStatus?.ACTIVE) {
    const params = {
      createdAt: new Date(),
      readAt: null,
      type: "subscription",
      uid: afterData?.maker, // ATHLETE
      to: afterDataId,
      source: {
        avatar: afterData?.takerData?.avatar,
        fullName: afterData?.takerData?.name,
        id: afterData?.taker,
      },
      status: NotificationStatusType.NOT_READ,
      eventType: NotificationEventType.FAN_SUBSCRIBE_ATHLETE,
    };

    await admin.firestore().collection("notification").add(params);
  }
});
