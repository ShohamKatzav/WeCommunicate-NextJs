import Message from "../models/Message";

interface MessageDTO {
    date: Number;
    sender: string;
    value: string;
}

type ChatQuery = {
    date: {
        $gt: any;
    };
} | {
    date?: undefined;
};

export default class MessageRepository {
    static async GetMessages(query: ChatQuery, limit: number, skip: number) {
        try {
            return await Message.find(query).skip(skip).limit(limit).exec();
        } catch (err) {
            console.error('Failed to find messages:', err);
            throw err;
        }
    }

    static async SaveMessage(data: MessageDTO) {
        try {
            const { date, sender, value } = data;
            return await Message.create({ date, sender, value });
        } catch (err) {
            console.error('Failed to save message:', err);
            throw err;
        }
    };

    static async countMessages(query: ChatQuery) {
        return await Message.countDocuments(query);
    }
}