import {test} from "./index.test"
import {it} from "mocha";
import * as admin from "firebase-admin";
import * as sinon from "sinon";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const stripeCustomer = require("./stripeCustomers");
describe("stripeCustomer", () => {
    before(()=>{
        sinon.stub(admin, "initializeApp");
        admin.initializeApp({
            projectId: "heros-dev-386505",
        })
    })
    it("Se crea el usuario nuevo", async ()=> {
        const timestamp = Date.now()
        const wrapped = test.wrap(stripeCustomer.onUserCreate);
        await wrapped(await test.auth.makeUserRecord({
            uid: `nuevo_${timestamp}`,
            email: `nuevo_${timestamp}@bloqhab.xyz`
        }));
    })
})
