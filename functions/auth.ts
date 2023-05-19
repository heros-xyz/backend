import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
// eslint-disable-next-line import/no-unresolved
import * as functions2 from "firebase-functions/v2";
import * as speakeasy from "speakeasy";
import sgMail from "@sendgrid/mail";

export interface User {
  uid: string;
  avatar: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  profileType: "FAN" | "ATHLETE" | "ADMIN";
  stripeCustomer: string;
}

async function sendEmail(email: string, secret: string) {
  //TODO: Mover esto a secrets
  sgMail.setApiKey(
    "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"
  );
  const msg = {
    to: email,
    from: {
      email: "hi@heros.xyz",
    },
    templateId: "d-7aab392c1d28448990a112862eb96b8e",
    dynamicTemplateData: {
      otp: speakeasy.totp({
        secret: secret,
        encoding: "base32",
      }),
    },
  };
  await sgMail.send(msg);
}

exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
  // Crear el documento en /user y /user/{uid}/private
  await admin.firestore().collection("user").doc(user.uid).set(
    {
      email: user.email,
    },
    { merge: true }
  );

  await admin
    .firestore()
    .collection("athleteProfile")
    .doc(user.uid)
    .set({}, { merge: true });

  await admin
    .firestore()
    .collection("fanProfile")
    .doc(user.uid)
    .set({}, { merge: true });
});

exports.signup = functions2.https.onCall(async (request: any) => {
  const { email, profileType } = request.data;
  let user: admin.auth.UserRecord;
  user = await admin.auth().getUserByEmail(email);
  try {
    if (user) {
      throw new functions2.https.HttpsError(
        "already-exists",
        "USER_ALREADY_REGISTERED"
      );
    }
    user = await admin.auth().createUser({
      email: email,
      emailVerified: false,
      disabled: false,
    });
  } catch (error: any) {
    if (error.code !== "auth/email-already-exists") {
      throw new functions.https.HttpsError(
        "already-exists",
        "USER_ALREADY_REGISTERED"
      );
    }
  }

  // Crear el secreto OTP
  const { base32: secret } = speakeasy.generateSecret({ length: 20 });

  await admin.firestore().doc(`user/${user.uid}`).set({
    email,
    profileType,
  });

  await admin.firestore().doc(`otp/${user.uid}`).set({
    secret,
  });

  await sendEmail(email, secret);
});

exports.signin = functions2.https.onCall(async (request: any) => {
  const { email } = request.data;
  let userRecord: admin.auth.UserRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
  } catch (error) {
    throw new functions2.https.HttpsError("not-found", "MUST_SIGN_UP_FIRST");
  }

  const otpDoc = await admin
    .firestore()
    .collection("otp")
    .doc(userRecord.uid)
    .get();

  if (!otpDoc.exists) {
    throw new functions2.https.HttpsError("not-found", "MUST_SIGN_UP_FIRST");
  }

  const { secret } = otpDoc.data() as { secret: string };

  await sendEmail(email, secret);
});

exports.verify = functions2.https.onCall(async (req: any) => {
  const { email, otp } = req.data;
  let userRecord: admin.auth.UserRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
  } catch (error) {
    throw new functions2.https.HttpsError("not-found", "MUST_SIGN_UP_FIRST");
  }

  // Obtener el secreto OTP
  const otpDoc = await admin
    .firestore()
    .collection("otp")
    .doc(userRecord.uid)
    .get();

  if (!otpDoc.exists) {
    throw new functions2.https.HttpsError("not-found", "MUST_SIGN_UP_FIRST");
  }

  const { secret, lastUsed = "" } = otpDoc.data() as {
    secret: string;
    lastUsed?: string;
  };

  if (lastUsed === otp) {
    throw new functions2.https.HttpsError("not-found", "OTP_ALREADY_USED");
  }

  // Verificar el código OTP
  const verified = speakeasy.totp.verify({
    secret: secret,
    encoding: "base32",
    token: otp,
    window: 6,
  });

  if (!verified) {
    throw new functions2.https.HttpsError("not-found", "INVALID_OTP");
  }

  await admin
    .firestore()
    .collection("otp")
    .doc(userRecord.uid)
    .update({ lastUsed: otp });

  // Generar un token de sesión
  return admin.auth().createCustomToken(userRecord.uid);
});
