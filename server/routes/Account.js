const express = require("express");
const router = express.Router();

const {
    Auth,
    Verify,
    CheckAccount }
    = require("../controllers/accountController");

router.post("/auth", Auth);
router.post("/verify", Verify);
router.post("/check-account", CheckAccount);

module.exports = router;