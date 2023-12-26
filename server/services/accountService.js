const jwt = require('jsonwebtoken');
const jwtSecretKey = process.env.TOKEN_SECRET;
const bcrypt = require("bcrypt")

const AccountRepository = require("../database/AccountDal");
const accountRepo = new AccountRepository();

const authOrCreate = async (email, password) => {
    try {
        const user = await accountRepo.getUserByEmail(email)

        // If found, compare the hashed passwords and generate the JWT token for the user
        if (user !== null) {
            const result = await bcrypt.compare(password, user.password);
            if (!result) {
                return ({ statusCode: 401, data: { message: "Invalid password" } });
            } else {
                let loginData = {
                    email,
                    signInTime: Date.now(),
                };
                const token = jwt.sign(loginData, jwtSecretKey);
                return ({ statusCode: 200, data: { message: "Success", token } });
            }
            // If no user is found, hash the given password and create a new entry in the auth db with the email and hashed password
        } else if (user === null) {
            const hash = await bcrypt.hash(password, 10);
            try {
                await accountRepo.addUser(email, hash);
            } catch (err) {
                return ({ statusCode: 500, data: { error: "Internal Server Error" } });
            }

            let loginData = {
                email,
                signInTime: Date.now(),
            };

            const token = jwt.sign(loginData, jwtSecretKey);
            return ({ statusCode: 201, data: { message: "Success", token } });
        }
    } catch (err) {
        console.error('Error in authOrCreate:', err);
        return ({ statusCode: 500, data: { error: "Internal Server Error" } });
    }
}


// An endpoint to see if there's an existing account for a given email address
const checkAccount = async (email) => {
    const user = await accountRepo.getUserByEmail(email)
    return ({
        status: user !== null ? "User exists" : "User does not exist", userExists: user !== null
    })
}

const getUsersList = async () => {
    const userNames = await accountRepo.getUsernames();
    return ({ statusCode: userNames.statusCode, data: userNames.data });
}


module.exports = {
    authOrCreate,
    checkAccount,
    getUsersList
};