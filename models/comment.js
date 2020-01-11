const mongoose = require('mongoose');

const uniqueValidator = require('mongoose-unique-validator');

const Schema = mongoose.Schema;

const commentSchema = Schema({
    comment: { type: String, required: true },
    author: { type: mongoose.Types.ObjectId, required: true, ref: 'User' },
    likes: { type: Number, default: 0 },
    publishedDate: { type: Date, default: new Date() }
});

module.exports = mongoose.model('Comment', commentSchema);