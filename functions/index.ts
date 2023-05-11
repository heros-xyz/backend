import * as admin from "firebase-admin";

admin.initializeApp();

exports.auth = require("./auth");
