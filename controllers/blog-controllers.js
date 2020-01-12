const { validationResult } = require('express-validator');

const mongoose = require('mongoose');

const HttpError = require('../models/http-error');
const Blog = require('../models/blog');
const User = require('../models/user');
const CommentThread = require('../models/comment-thread');
const utils = require('../utils/utils');

const getBlogs = async (req, res, next) => {
    let blogs;
    try {
        blogs = await Blog.find();
    } catch (e) {
        return next(
            new HttpError('Failed to get blogs', 500)
        );
    }
    res.json({
        blogs:
            blogs.map(blog => blog.toObject({getters:true})
            )
    });
};

const getBlogById = async (req, res, next) => {
    const blogId = req.params.bid;

    let blog;
    try {
        blog = await Blog.findById(blogId).populate('commentThread')
    } catch (e) {
        return next(new HttpError('Failed to get blog by id'), 500)
    }

    res.json( {blog: blog.toObject({ getters: true })})
};

const getBlogsByUserId = async (req, res, next) => {
    const userId = req.params.uid;

    let userWithBlogs;
    try {
        userWithBlogs = await User.findById(userId).populate('blogPosts')
    } catch (e) {
        return next(
            new HttpError('Could not find Blogs by User id', 500)
        );
    }

    res.json({ blogs: userWithBlogs.blogPosts.map(blog =>
            blog.toObject({ getters: true })
        )})
};

const createBlog = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return next(
            new HttpError('Invalid inputs passed, please check your data.', 422)
        );
    }
    const { title, author, content } = req.body;

    let user;
    try {
        user = await User.findById(author);
    } catch (e) {
        return next(
            new HttpError('Failed to create blog, please try again later'), 500
        );
    }
    if (!user) {
        return next(
            new HttpError('Could not find user with provided id', 404)
        );
    }

    // const newCommentThread = new CommentThread({
    // });
    //
    // try {
    //     await newCommentThread.save()
    // } catch (e) {
    //     return next(new HttpError('Failed to create comment thread, please try again later', 500))
    // }

    let createdBlog = new Blog({
        title,
        author: user,
        content,
    });


    try {
        const sess = await mongoose.startSession();
        sess.startTransaction();
        await createdBlog.save({ session: sess });
        user.blogPosts.push(createdBlog);
        await user.save({ session: sess });
        await sess.commitTransaction();
    } catch (e) {
        console.log(e);
        return next(
            new HttpError('Failed to create blog, please try again later',  500)
        );
    }

    res.status(201).json({
        blog:
            {
                ...createdBlog.toObject(),
                author:
                    {
                        username: createdBlog.author.username
                    }
            }
    }) // returning a modified version where the author field only contains username
};

exports.getBlogs = getBlogs;
exports.getBlogById = getBlogById;
exports.getBlogsByUserId = getBlogsByUserId;
exports.createBlog = createBlog;