import {test} from "./index.test"
import {it} from "mocha";
import {stripeCustomer} from "./index";
import * as admin from "firebase-admin";
import * as sinon from "sinon"

sinon.stub(admin, "initializeApp");
admin.initializeApp({
    projectId: "heros-dev-386505",
})
describe("stripeCustomer", () => {
    it("Se crea el usuario nuevo", async ()=> {
        const timestamp = Date.now()
        const wrapped = test.wrap(stripeCustomer.onUserCreate);
        await wrapped(await test.auth.makeUserRecord({
            uid: `nuevo_${timestamp}`,
            email: `nuevo_${timestamp}@bloqhab.xyz`
        }));
    })
})
