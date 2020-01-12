const { validationResult } = require('express-validator');

const mongoose = require('mongoose');
const HttpError = require('../models/http-error');
const User = require('../models/user');
const Comment = require('../models/comment');
const Blog = require('../models/blog');

const commentThread = require('../models/comment-thread');

const createComment = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return next(
            new HttpError('Invalid inputs passed, please check your data.', 422)
        );
    }

    const { postId, content, authorId } = req.body;

    let blogPost;
    try {
        blogPost = await Blog.findById(postId)
    } catch (e) {
        return next(
            new HttpError('Failed to create comment, please try again later', 500)
        )
    }
    let commentAuthor;
    try {
        commentAuthor = await User.findById(authorId);
    } catch (e) {
        return next(
            new HttpError('Failed to create comment, please try again later', 500)
        )
    }

    if (!commentAuthor || !blogPost) {
        return next(
            new HttpError('Invalid input, please try again', 401)
        )
    }


    const createdComment = new Comment({
        content,
        post: blogPost,
        author: commentAuthor.toObject({ getters: true }),
    });

    try {
        const sess = await mongoose.startSession();
        sess.startTransaction();
        await createdComment.save({ session: sess });
        blogPost.comments.push(createdComment);
        await blogPost.save({ session: sess });
        await sess.commitTransaction();
    } catch (e) {
        console.log(e);
        return next(
            new HttpError('Failed to create comment, please try again later',  500)
        );
    }
    res.status(201).json({
        comment: {
            content,
            author: {
                username: commentAuthor.username,
            },
            likes: 0,
            comments: blogPost.toObject({ getters: true })
        }
    })
};

const

exports.createComment = createComment;