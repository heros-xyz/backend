import * as admin from "firebase-admin";

admin.initializeApp();

exports.auth = require("./auth");
exports.stripeCustomers = require("./stripeCustomers");
exports.membershipTiers = require("./membershipTiers");
exports.paymentMethod = require("./paymentMethod");
exports.suscriptions = require("./suscriptions");
exports.stripe = require("./stripe");
