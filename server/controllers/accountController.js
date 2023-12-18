const jwt = require('jsonwebtoken');
const jwtSecretKey = process.env.TOKEN_SECRET;
const bcrypt = require("bcrypt")

const Account = require("../models/Account");

const guard = require("../guards/guard")

const Auth = async (req, res) => {
    const { email, password } = req.body;

    // Look up the user entry in the database
    const user = await findUserByEmail(email);

    // If found, compare the hashed passwords and generate the JWT token for the user
    if (user !== null) {
        bcrypt.compare(password, user.password, function (_err, result) {
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
    } else if (user === null) {
        bcrypt.hash(password, 10, async function (_err, hash) {
            try {
                await Account.create({ email, password: hash });
            } catch (err) {
                console.error('Failed to insert document:', err);
                res.status(500).json({ error: 'Internal Server Error' });
            }

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
const CheckAccount = async (req, res) => {
    const { email } = req.body

    const user = await findUserByEmail(email);

    res.status(200).json({
        status: user !== null ? "User exists" : "User does not exist", userExists: user !== null
    })
}

const GetUsernames = async (req, res) => {
    guard(req, res, async () => {
        try {
            const users = await Account.find().exec();
            const userNames = users.map(user => user.email)
            res.status(200).json({ userNames: userNames, message: "success" });
        } catch (err) {
            console.error('Could not get usernames:', err);
            throw err;
        }
    });
}

const findUserByEmail = async (email) => {
    try {
        return await Account.findOne({
            email: { $regex: new RegExp("^" + email, "i") }
        });
    } catch (err) {
        console.error('Failed to find user:', err);
        throw err;
    }
};

module.exports = {
    Auth,
    Verify,
    CheckAccount,
    GetUsernames
};