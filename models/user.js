const mongoose = require('mongoose');

const uniqueValidator = require('mongoose-unique-validator');

const Schema = mongoose.Schema;

const userSchema = new Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    intraId: { type: Number, required: true },
    blogPosts: [{ type: mongoose.Types.ObjectId, default: [], ref: 'Blog' }]
});

userSchema.plugin(uniqueValidator);

module.exports = mongoose.model('User', userSchema);