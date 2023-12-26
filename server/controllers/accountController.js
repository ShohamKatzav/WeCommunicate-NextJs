const guard = require("../guards/guard")
const {
    authOrCreate,
    checkAccount,
    getUsersList
} = require("../services/accountService");

const Auth = async (req, res) => {
    const { email, password } = req.body;
    try {
        const authResult = await authOrCreate(email, password);
        res.status(authResult.statusCode).json(authResult.data);
    } catch (err) {
        console.error('Failed to Auth:', err);
        res.sendStatus(500);
    }
}

// The verify endpoint that checks if a given JWT token is valid
const Verify = (req, res) => {
    guard(req, res, () => {
        res.status(200).json({ status: "logged in", message: "success" });
    });
}

// An endpoint to see if there's an existing account for a given email address
const IsUserExists = async (req, res) => {
    const { email } = req.body
    try {
        const user = await checkAccount(email);
        res.status(200).json(user);
    } catch (err) {
        console.error('Failed to determine whether the user exist:', err);
        res.sendStatus(500);
    }
}

const GetUsernames = async (req, res) => {
    guard(req, res, async () => {
        try {
            const usersListResult = await getUsersList();
            res.status(usersListResult.statusCode).json(usersListResult.data);
        } catch (err) {
            console.error('Failed to get usernames:', err);
            res.sendStatus(500);
        }
    });
}


module.exports = {
    Auth,
    Verify,
    IsUserExists,
    GetUsernames
};