module.exports = (server) => {
  const io = require("socket.io")(server, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"],
    },
  });

  const Chat = require("../controllers/chatController")(io);

  io.on('connection', Chat);
};