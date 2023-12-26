const express = require("express");
const router = express.Router();

const {
    Auth,
    Verify,
    IsUserExists,
    GetUsernames }
    = require("../controllers/accountController");

router.post("/auth", Auth);
router.post("/verify", Verify);
router.post("/is-exist", IsUserExists);
router.get("/get-usernames", GetUsernames);

module.exports = router;