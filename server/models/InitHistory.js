const mongoose = require('mongoose');
const { Schema } = mongoose;

const initHistorySchema = new Schema({
    accountID: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true
    },
}, {
    capped: { size: 1024 },
    autoCreate: false
});

module.exports = mongoose.model('InitHistory', initHistorySchema);