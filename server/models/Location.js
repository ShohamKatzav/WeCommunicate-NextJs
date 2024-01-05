const mongoose = require('mongoose');
const { Schema } = mongoose;

const locationSchema = new Schema({
    latitude: {
        type: Number,
        required: true
    },
    longitude: {
        type: Number,
        required: true
    },
    accuracy: {
        type: Number,
        required: true
    },
    error: {
        type: String,
        required: false
    },
    accountID: {
        type: String,
        required: true
    },
    time: {
        type: Date,
        required: true
    },
}, {
    capped: { size: 1024 },
    autoCreate: false
});

module.exports = mongoose.model('Location', locationSchema);