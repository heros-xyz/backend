import {Timestamp} from "firebase-admin/lib/firestore";
import * as admin from "firebase-admin";

export enum CollectionPath {
    NOTIFICATIONS = "notification",
    ATHLETE_PROFILE = "athleteProfile",
    COMMENTS = "comments",
    USER = "user",
    POSTS = "post",
    FAN_PROFILE = "fanProfile"
}

export interface WithdrawalRequest {
    bankName: string;
    cardNumber: string;
    swiftCode: string;
    uid: string;
}

export interface FanProfile {
    avatar?: string
    uid?: string
    sports?: {
        key: string
        label: string
    }[]
    nickName?: string
    fullName: string
    firstName: string
    lastName: string
}

export interface User {
    uid: string;
    avatar: string;
    firstName: string;
    lastName: string;
    fullName: string;
    nickName?: string;
    email: string;
    profileType: "FAN" | "ATHLETE" | "ADMIN";
    stripeCustomer: string;
}

export interface AthleteProfile {
    avatar: string;
    firstName: string;
    lastName: string;
    fullName: string;
    nickName?: string;
    postsDates: {
        id: string;
        date: admin.firestore.Timestamp;
    }[];
}

export interface SignupRequest {
    email: string;
    profileType: "FAN" | "ATHLETE" | "ADMIN";
}

export interface SigninRequest {
    email: string;
}

export interface VerifyRequest {
    email: string;
    otp: string;
}

export interface Comment {
    post: string
    content: string
    parent?: string
    author: string
    authorProfile: FanProfile | AthleteProfile
    authorProfileCollection: CollectionPath
    commentsCount: number
    reactionsCount: number
    createdAt: Timestamp
    deletedAt?: Timestamp
}

export interface CommentRequest {
    post: string;
    content: string;
    parent?: string;
}
