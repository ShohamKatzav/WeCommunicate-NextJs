var low = require("lowdb");
var FileSync = require("lowdb/adapters/FileSync");
var adapter = new FileSync("./database/database.json");
var db = low(adapter);

const guard = require("../guards/guard")

const Chat = (io) => (socket) => {
    guard(socket.handshake, null, (error) => {
        if (error) {
            console.error(error.message);
            socket.disconnect(true); // Disconnect the socket in case of authentication error
        } else {
            console.log(`${socket.id} connected`);

            socket.on('chat message', (message) => {
                io.emit('chat message', message); // Broadcast the message to all connected clients
            });

            socket.on('disconnect', () => {
                console.log(`${socket.id} disconnected`);
            });
        }
    });
};

const GetData = (req, res) => {
    guard(req, res, () => {
        const chat = db.get("chat").value();
        res.status(200).json({ message: "success", chat });
    });
};

const SaveData = (req, res) => {
    guard(req, res, () => {
        const { date, sender, value } = req.body;
        db.get("chat").push({ date, sender, value }).write();
        res.status(200).json();
    });
};


module.exports = {
    Chat,
    GetData,
    SaveData
};