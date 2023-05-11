import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v2";
import * as speakeasy from "speakeasy";
import * as sgMail from "@sendgrid/mail";

exports.signup = functions.https.onCall(async (request: any) => {
    const { email, profileType } = request.data;
    try {
        await admin.auth().getUserByEmail(email);
        throw new functions.https.HttpsError("already-exists", "error.MUST_SIGN_UP_FIRST");
    } catch (error) {
        console.error(error)
    }

    // Crear el usuario en firebase.Auth
    const newUser = await admin.auth().createUser({
        email: email,
        emailVerified: false,
        disabled: false,
    });

    // Crear el secreto OTP
    const secret = speakeasy.generateSecret({ length: 20 });

    // Crear el documento en /user y /user/{uid}/private
    await admin.firestore().collection("user").doc(newUser.uid).set({
        email,
        profileType,
    });

    await admin
        .firestore()
        .collection("otp")
        .doc(newUser.uid)
        .set({
            secret: secret.base32,
        });

    await admin
        .firestore()
        .collection("athleteProfile")
        .doc(newUser.uid)
        .set({});

    await admin
        .firestore()
        .collection("fanProfile")
        .doc(newUser.uid)
        .set({});

    // Enviar código OTP por email usando SendGrid
    sgMail.setApiKey("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");
    const msg = {
        to: email,
        from: {
            name: "Heros.XYZ 🧱",
            email: "hi@heros.xyz"
        },
        templateId: "d-7aab392c1d28448990a112862eb96b8e",
        dynamicTemplateData: {
            otp: speakeasy.totp({
                secret: secret.base32,
                encoding: "base32",
            })
        },
    };
    await sgMail.send(msg);
});

exports.signin = functions.https.onCall(async (request: any) => {
    const { email } = request.data;
    let userRecord: admin.auth.UserRecord;
    try {
        userRecord = await admin.auth().getUserByEmail(email);
    } catch (error) {
        throw new functions.https.HttpsError("not-found", "error.MUST_SIGN_UP_FIRST");
    }

    const otpDoc = await admin
        .firestore()
        .collection("otp")
        .doc(userRecord.uid)
        .get();

    if (!otpDoc.exists) {
        throw new functions.https.HttpsError("not-found", "error.MUST_SIGN_UP_FIRST");
    }

    // @ts-ignore
    const { secret } = otpDoc.data();

    sgMail.setApiKey("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");
    const msg = {
        to: email,
        from: {
            name: "Heros.XYZ 🧱",
            email: "hi@heros.xyz"
        },
        templateId: "d-7aab392c1d28448990a112862eb96b8e",
        dynamicTemplateData: {
            otp: speakeasy.totp({
                secret,
                encoding: "base32",
            })
        },
    };
    await sgMail.send(msg);
});

exports.verify = functions.https.onCall(async (req: any) => {
    const { email, otp } = req.data;
    let userRecord: admin.auth.UserRecord;
    try {
        userRecord = await admin.auth().getUserByEmail(email);
    } catch (error) {
        throw new functions.https.HttpsError("not-found", "error.MUST_SIGN_UP_FIRST");
    }

    // Obtener el secreto OTP
    const otpDoc = await admin
        .firestore()
        .collection("otp")
        .doc(userRecord.uid)
        .get();

        if (!otpDoc.exists) {
            throw new functions.https.HttpsError("not-found", "error.MUST_SIGN_UP_FIRST");
        }

        // @ts-ignore
        const {secret, lastUsed = ""} = otpDoc.data();

        if (lastUsed === otp) {
            throw new functions.https.HttpsError("not-found", "error.OTP_ALREADY_USED");
        }

        // Verificar el código OTP
        const verified = speakeasy.totp.verify({
            secret: secret,
            encoding: "base32",
            token: otp,
            window: 6
        });

        if (!verified) {
            throw new functions.https.HttpsError("not-found", "verified");
        }

        await admin
            .firestore()
            .collection("otp")
            .doc(userRecord.uid)
            .update({lastUsed: otp});

        // Generar un token de sesión
        return admin.auth().createCustomToken(userRecord.uid);
})
