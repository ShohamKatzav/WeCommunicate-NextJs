const InitHistory = require("../models/InitHistory");

class InitHistoryRepository {
    async findInitHistory(accountId) {
        try {
            return await InitHistory.findOne({
                accountID: accountId
            });
        } catch (err) {
            console.error('Failed to find Init History time:', err);
            throw err;
        }
    }

    async updateInitHistory(accountId) {
        try {
            return await InitHistory.updateOne({ accountID: accountId }, { $set: { date: Date.now() } });
        } catch (err) {
            console.error('Failed to update Init History time:', err);
            throw err;
        }
    }

    async createInitHistory(accountId) {
        try {
            return await InitHistory.create({ accountID: accountId, date: Date.now() });
        } catch (err) {
            console.error('Failed to create Init History time:', err);
            throw err;
        }
    }
}

module.exports = InitHistoryRepository;