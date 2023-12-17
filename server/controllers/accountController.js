const jwt = require('jsonwebtoken');
const jwtSecretKey = process.env.TOKEN_SECRET;
const bcrypt = require("bcrypt")

var low = require("lowdb");
var FileSync = require("lowdb/adapters/FileSync");
var adapter = new FileSync("./database/database.json");
var db = low(adapter);

const guard = require("../guards/guard")

const Auth = (req, res) => {
    const { email, password } = req.body;

    // Look up the user entry in the database
    const user = db.get("users").value().filter(user => ciEquals(email, user.email))

    // If found, compare the hashed passwords and generate the JWT token for the user
    if (user.length === 1) {
        bcrypt.compare(password, user[0].password, function (_err, result) {
            if (!result) {
                return res.status(401).json({ message: "Invalid password" });
            } else {
                let loginData = {
                    email,
                    signInTime: Date.now(),
                };
                const token = jwt.sign(loginData, jwtSecretKey);
                res.status(200).json({ message: "success", token });
            }
        });
        // If no user is found, hash the given password and create a new entry in the auth db with the email and hashed password
    } else if (user.length === 0) {
        bcrypt.hash(password, 10, function (_err, hash) {
            db.get("users").push({ email, password: hash }).write()

            let loginData = {
                email,
                signInTime: Date.now(),
            };

            const token = jwt.sign(loginData, jwtSecretKey);
            res.status(200).json({ message: "success", token });
        });

    }
}

// The verify endpoint that checks if a given JWT token is valid
const Verify = (req, res) => {
    guard(req, res, () => {
        res.status(200).json({ status: "logged in", message: "success" });
    });
}

// An endpoint to see if there's an existing account for a given email address
const CheckAccount = (req, res) => {
    const { email } = req.body
    const user = db.get("users").value().filter(user => ciEquals(email, user.email))

    res.status(200).json({
        status: user.length === 1 ? "User exists" : "User does not exist", userExists: user.length === 1
    })
}

const ciEquals = (a, b) => {
    return typeof a === 'string' && typeof b === 'string'
        ? a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0
        : a === b;
}

module.exports = {
    Auth,
    Verify,
    CheckAccount
};