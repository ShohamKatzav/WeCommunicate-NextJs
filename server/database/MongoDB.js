require('dotenv').config({ path: "../.env" })
const mongoose = require("mongoose");
const dbName = "WeCommunicateDB";

async function connectDB() {
    try {
        await mongoose.connect(process.env.DB_URI, {
            dbName: dbName
        });
    }
    catch (e) {
        console.error(e);
    }
}

module.exports = { connectDB }

