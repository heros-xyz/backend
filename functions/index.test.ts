import * as fft from "firebase-functions-test"

export const test = fft();

test.mockConfig({
    stripe: {
        secret: "sk_test_51N3iHSIaE495kvrkHHOlGMunzqORnjPCBQImK4D4PccKWmG05QtvdlZleNEi7aS95IodbtAPvjm7LCVNF3EnFymz002NyQmytw"
    }
})
