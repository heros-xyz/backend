import {Timestamp} from "firebase-admin/lib/firestore";
import * as admin from "firebase-admin";

export enum CollectionPath {
    notification = "notification",
    athleteProfile = "athleteProfile",
    comments = "comments",
    user = "user",
    post = "post",
    fanProfile = "fanProfile",
    invoices = "invoices",
    withdrawal = "withdrawal"
}

export interface WithdrawalRequest {
    bankName: string;
    cardNumber: string;
    swiftCode: string;
}

export enum OperationStatus {
    pending = "pending",
    processing = "processing",
    succeed = "succeed",
    fail = "fail"
}

export interface Withdrawal extends WithdrawalRequest{
    uid: string;
    amount: number;
    status: OperationStatus
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
  id: string;
  uid: string;
  avatar: string;
  firstName: string;
  lastName: string;
  fullName: string;
  nickName?: string;
  email: string;
  profileType: "FAN" | "ATHLETE" | "ADMIN";
  stripeCustomer: string;
  netAmount: number;
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
  id?: string;
  post: string;
  content: string;
  parent?: string;
  author: string;
  authorProfile: FanProfile | AthleteProfile;
  authorProfileCollection: CollectionPath;
  commentsCount: number;
  reactionsCount: number;
  createdAt: Timestamp;
  deletedAt?: Timestamp;
}

export interface CommentRequest {
    post: string;
    content: string;
    parent?: string;
}
