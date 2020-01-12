const { validationResult } = require('express-validator');

const mongoose = require('mongoose');
const Blog = require('../models/blog');
const User = require('../models/user');
const CommentThread = require('../models/comment-thread');

const countComments = async (commentThread, count = 0) => {
    console.log(commentThread);

    for (var i = 0; i < commentThread.comments.length; i++){
        const comment = await Comment.findById(commentThread.comments[i]);
        if (comment)
            count = countComments(comment.commentThread, count + 1);
    }
    console.log(count);
    return (count);
};

exports.countComments = countComments;