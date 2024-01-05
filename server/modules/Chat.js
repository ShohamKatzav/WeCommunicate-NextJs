const express = require("express");
const router = express.Router();
const communicationController = require("../controllers/communicationController");
const { Chat, GetData, SaveData, InitChatHistory } = communicationController;

module.exports = (server) => {
  const io = require("socket.io")(server, {
    connectionStateRecovery: {
      // the backup duration of the sessions and the packets
      maxDisconnectionDuration: 2 * 60 * 1000,
      // whether to skip middlewares upon successful recovery
      skipMiddlewares: true,
    },
    cors: {
      origin: ["http://localhost:3000", "https://we-communicate.vercel.app"],
      methods: ["GET", "POST"],
    },
  });

  const chatInstance = Chat(io);
  io.on('connection', chatInstance);

  router.get("/get-data", GetData);
  router.post("/save-data", SaveData);
  router.put("/init-history", InitChatHistory);
  
  return { io, router };
};