const mongoose = require('mongoose');
const { Schema } = mongoose;

const messageSchema = new Schema({
    date: {
        type: Date,
        required: true
    },
    sender: {
        type: String,
        required: true
    },
    value: {
        type: String,
        required: true
    }
}, {
    capped: { size: 1024 },
    autoCreate: false
});

module.exports = mongoose.model('Message', messageSchema);