const mongoose = require('mongoose');

const uniqueValidator = require('mongoose-unique-validator');

const Schema = mongoose.Schema;

const blogSchema = Schema({
    title: { type: String, required: true },
    likes: { type: Number, default: 0 },
    content: { type: String, required: true},
    author: { type: mongoose.Types.ObjectId, ref: 'User' },
    publishedDate: { type: Date, default: new Date()},
    comments: [{ type: mongoose.Types.ObjectId, default: [], ref: 'Comment' }]
});

module.exports = mongoose.model('Blog', blogSchema);