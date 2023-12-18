const express = require("express");
const router = express.Router();

const {
    Auth,
    Verify,
    CheckAccount,
    GetUsernames }
    = require("../controllers/accountController");

router.post("/auth", Auth);
router.post("/verify", Verify);
router.post("/check-account", CheckAccount);
router.get("/get-usernames", GetUsernames);

module.exports = router;