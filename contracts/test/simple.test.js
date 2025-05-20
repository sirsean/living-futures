const { expect } = require("chai");

describe("Simple Test", function () {
    it("Should pass basic test", async function () {
        expect(1 + 1).to.equal(2);
    });
});