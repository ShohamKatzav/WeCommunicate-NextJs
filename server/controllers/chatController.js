const Message = require("../models/Message");
const Account = require("../models/Account");
const InitHistory = require("../models/InitHistory");

const guard = require("../guards/guard")

const connectedUsers = [];

const Chat = (io) => (socket) => {
    guard(socket.handshake, null, async (error) => {
        if (error) {
            console.error(error.message);
            socket.disconnect(true, { error: error.message }); // Disconnect the socket in case of authentication error
        } else {
            socket.join('chat room');
            console.log(`${socket.id} connected to the chat`);
            connectedUsers.push({ id: socket.id, email: socket.handshake.user.email });
            io.to('chat room').emit('update users', connectedUsers);

            socket.on('chat message', (message) => {
                io.to('chat room').emit('chat message', message); // Broadcast the message to all connected clients
            });

            socket.on('disconnect', async () => {
                console.log(`${socket.id} disconnected`);
                const userIndex = connectedUsers.findIndex(user => user.id === socket.id);
                connectedUsers.splice(userIndex, 1);
                io.to('chat room').emit('update users', connectedUsers);
            });
        }
    });
};

const GetData = (req, res) => {
    guard(req, res, async () => {
        const { email, page, perPage } = req.query;
        try {
            const user = await Account.findOne({
                email: { $regex: new RegExp("^" + email, "i") }
            });
            const initHistoryTime = await InitHistory.findOne({
                accountID: user._id
            });

            const chatQuery = initHistoryTime ? { date: { $gt: initHistoryTime.date } } : {};
            const tottalCount = await Message.find(chatQuery).count().exec();
            if (tottalCount < perPage * page) {
                if (perPage * page - perPage > tottalCount) {
                    const chat = [];
                    res.status(200).json({ message: "All data fetched", chat });
                    return;
                }
                const limit = tottalCount % perPage;
                const chat = await Message.find(chatQuery).limit(limit).exec();
                res.status(200).json({ message: "All data fetched", chat });
                return;
            }
            const chat = await Message.find(chatQuery).skip(tottalCount - perPage * page).limit(perPage).exec();
            res.status(200).json({ message: "success", chat });
        } catch (err) {
            console.error('Failed to retrieve messages:', err);
            res.sendStatus(500);
        }
    });
};

const SaveData = (req, res) => {
    guard(req, res, async () => {
        const { date, sender, value } = req.body;
        try {
            const newDocument = await Message.create({ date, sender, value });
            res.status(200).json({ message: "success", newDocument });
        } catch (err) {
            console.error('Failed to insert document:', err);
            res.sendStatus(500);
        }
    });
};

const InitChatHistory = (req, res) => {
    guard(req, res, async () => {
        const { email } = req.body;
        try {
            const user = await Account.findOne({
                email: { $regex: new RegExp("^" + email, "i") }
            });
            const existInitHistory = await InitHistory.findOne({
                accountID: user._id
            });
            const updatedDocument = existInitHistory ?
                await InitHistory.updateOne({
                    accountID: user._id
                }, { $set: { date: Date.now() } })
                : await InitHistory.create({ accountID: user._id, date: Date.now() });
            res.status(200).json({ message: "success", updatedDocument });
        } catch (err) {
            console.error('Failed to initialize account history:', err);
            res.sendStatus(500);
        }
    });
};




module.exports = {
    Chat,
    GetData,
    SaveData,
    InitChatHistory
};