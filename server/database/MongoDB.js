require('dotenv').config({ path: "../.env" })
const mongoose = require("mongoose");

async function connectDB() {
    try {
        await mongoose.connect(process.env.DB_URI, {
            dbName: process.env.DB_NAME
        });
    }
    catch (e) {
        console.error(e);
    }
}

module.exports = { connectDB }

