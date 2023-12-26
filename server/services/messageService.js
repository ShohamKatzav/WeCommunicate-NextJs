
const AccountRepository = require("../database/AccountDal");
const accountRepo = new AccountRepository();

const MessageRepository = require("../database/MessageDal");
const messageRepo = new MessageRepository();

const InitHistoryRepository = require("../database/InitHistoryDal");
const inithistoryRepo = new InitHistoryRepository();

const getMessages = async (email, page, perPage) => {
    try {
        const user = await accountRepo.getUserByEmail(email);
        const initHistoryTime = await inithistoryRepo.findInitHistory(user._id);

        const chatQuery = initHistoryTime ? { date: { $gt: initHistoryTime.date } } : {};
        const totalCount = await messageRepo.countMessages(chatQuery);
        var chat = []
        const skipCount = perPage * page;
        if (totalCount < skipCount) {
            if (skipCount - perPage < totalCount)
                chat = await messageRepo.GetMessages(chatQuery, totalCount % perPage, null);
            return ({ statusCode: 200, data: { message: "All data fetched", chat } });
        }
        chat = await messageRepo.GetMessages(chatQuery, perPage, totalCount - perPage * page);
        return ({ statusCode: 200, data: { message: "success", chat } });
    } catch (err) {
        console.error('Failed to retrieve messages:', err);
        return ({ statusCode: 500, data: { error: "Internal Server Error" } });
    }
};

const saveMessage = async (data) => {
    try {
        const newDocument = await messageRepo.SaveMessage(data);
        return ({ statusCode: 200, data: { message: "success", newDocument } });
    } catch (err) {
        console.error('Failed to save message:', err);
        return ({ statusCode: 500, data: { error: "Internal Server Error" } });
    }
};

const initChatHistory = async (email) => {
    try {
        const user = await accountRepo.getUserByEmail(email);
        const existInitHistory = await inithistoryRepo.findInitHistory(user._id);
        const updatedDocument = existInitHistory ?
            await inithistoryRepo.updateInitHistory(user._id)
            : await inithistoryRepo.createInitHistory(user._id);
        return ({ statusCode: 200, data: { message: "success", updatedDocument } });
    } catch (err) {
        console.error('Failed to initialize account history:', err);
        return ({ statusCode: 500, data: { error: "Internal Server Error" } });
    }
};

module.exports = {
    getMessages,
    saveMessage,
    initChatHistory
};