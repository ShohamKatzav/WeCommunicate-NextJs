const Message = require("../models/Message");

class MessageRepository {
    async GetMessages(query, limit, skip) {
        try {
            return await Message.find(query).skip(skip).limit(limit).exec();
        } catch (err) {
            console.error('Failed to find messages:', err);
            throw err;
        }
    }

    async SaveMessage(data) {
        try {
            const { date, sender, value } = data;
            return await Message.create({ date, sender, value });
        } catch (err) {
            console.error('Failed to save message:', err);
            throw err;
        }
    };

    async countMessages(query) {
        return await Message.countDocuments(query);
    }
}

module.exports = MessageRepository;