const express = require('express'),
  PORT = 5000,
  app = express();
const cors = require('cors');
const http = require('http');
const server = http.createServer(app);

const dotenv = require('dotenv');
dotenv.config();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const mongoose = require("mongoose");
const { connectDB } = require("./database/MongoDB");
connectDB();


const accountRoutes = require("./routes/Account");
app.use("/api/v1", accountRoutes);

const chatModule = require('./modules/Chat')(server);
const route = chatModule.router;
app.use("/api/v1", route);

const cronRoutes = require('./routes/WakeUp');
app.use("/api/v1", cronRoutes);
const myCronJob = require('./modules/Cron');
myCronJob();

app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    console.log(err);
    return res.status(401).json({ error: 'Unauthorized' });
  }
});


mongoose.connection.once('open', () => {
  server.listen(PORT, () =>
    console.log(`WebSocket server listening on port ${PORT}`));
});
