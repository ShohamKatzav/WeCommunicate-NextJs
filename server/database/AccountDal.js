const Account = require("../models/Account");

class AccountRepository {
    async getUserByEmail(email) {
        try {
            return await Account.findOne({
                email: { $regex: new RegExp("^" + email, "i") }
            });
        } catch (err) {
            console.error('Failed to find user:', err);
            throw err;
        }
    }

    async getEmailById(accountID) {
        try {
            const user = await Account.findById(accountID).exec();
            return user?.email;
        } catch (err) {
            console.error('Failed to find user:', err);
            throw err;
        }
    }

    async addUser(email, hash) {
        try {
            const result = await Account.create({ email, password: hash });
            return result.insertedId;
        } catch (err) {
            console.error('Failed to create user:', err);
            throw err;
        }
    }

    async getUsernames() {
        try {
            const users = await Account.find().exec();
            const userNames = users.map(user => user.email);
            return { statusCode: 200, data: { userNames: userNames, message: "success" } };
        } catch (err) {
            console.error('Could not get usernames:', err);
            return { statusCode: 500, data: { message: "Internal Server Error" } };
        }
    }
}

module.exports = AccountRepository;