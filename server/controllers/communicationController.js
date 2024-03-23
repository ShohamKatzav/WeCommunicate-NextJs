const guard = require("../guards/guard")
const {
    getMessages,
    saveMessage,
    initChatHistory
} = require("../services/messageService");

const {
    getLocations,
    updateLocation
} = require("../services/locationService");

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

            socket.on('save location', async (location) => {
                await updateLocation(socket.handshake.user.email, location)
                const positions = await getLocations();
                io.to(socket.id).emit('get locations', positions?.data?.locations);
            });

            socket.on('get locations', async () => {
                const positions = await getLocations();
                io.to(socket.id).emit('get locations', positions?.data?.locations);
            });

            socket.on('get connected users', async () => {
                io.to(socket.id).emit('get connected users', connectedUsers);
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
            const chat = await getMessages(email, page, perPage);
            res.status(200).json(chat.data);
        } catch (err) {
            console.error('Failed to retrieve messages:', err);
            res.sendStatus(500);
        }
    });
};

const SaveData = (req, res) => {
    guard(req, res, async () => {
        try {
            const newMessage = await saveMessage(req.body);
            res.status(200).json({ message: "success", newMessage });
        } catch (err) {
            console.error('Failed to save message:', err);
            res.sendStatus(500);
        }
    });
};

const InitChatHistory = (req, res) => {
    guard(req, res, async () => {
        const { email } = req.body;
        try {
            const updatedDocument = await initChatHistory(email);
            res.status(200).json({ message: "success", updatedDocument });
        } catch (err) {
            console.error('Failed to initialize accounts chat history:', err);
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