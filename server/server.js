const express = require('express'),
    PORT = 5000,
    app = express();

const http = require('http');

const server = http.createServer(app);
const io = require("socket.io")(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});


app.get('/api/message', (req, res) => {
    res.json({ message: 'Hello from the backend!' });
});

io.on('connection', (socket) => {
    console.log(`${socket.id} connected`);

    // Handle chat messages
    socket.on('chat message', (message) => {
        io.emit('chat message', message); // Broadcast the message to all connected clients
    });

    socket.on('disconnect', () => {
        console.log(`${socket.id} disconnected`);
    });
});

server.listen(PORT, () => {
    console.log(`WebSocket server listening on port ${PORT}`);
});