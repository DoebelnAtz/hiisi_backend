"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_validator_1 = require("express-validator");
const express = require('express');
const blogsController = require('../controllers/blog-controllers');
const commentController = require('../controllers/comment-controllers');
const blogRouter = express.Router();
blogRouter.get('/', blogsController.getBlogs);
blogRouter.get('/:bid', blogsController.getBlogById);
blogRouter.get('/users/:uid', blogsController.getBlogsByUserId);
blogRouter.get('/commentthread/:tid', commentController.getCommentThreadById);
blogRouter.post('/create_blog', [
    express_validator_1.check('title')
        .not()
        .isEmpty(),
    express_validator_1.check('content')
        .not()
        .isEmpty(),
], blogsController.createBlog);
blogRouter.post('/vote_blog', [
    express_validator_1.check('blogId')
        .not()
        .isEmpty()
        .isNumeric(),
    express_validator_1.check('vote')
        .not()
        .isEmpty()
        .isNumeric(),
], blogsController.voteBlog);
blogRouter.post('/create_comment', [
    express_validator_1.check('threadId')
        .not()
        .isEmpty()
        .isNumeric(),
    express_validator_1.check('content')
        .not()
        .isEmpty(),
], commentController.createComment);
blogRouter.put('/update_blog', [
    express_validator_1.check('content')
        .not()
        .isEmpty(),
    express_validator_1.check('title')
        .not()
        .isEmpty(),
    express_validator_1.check('blogId')
        .not()
        .isEmpty(),
], blogsController.updateBlog);
blogRouter.delete('/delete_blog', [
    express_validator_1.check('blogId')
        .not()
        .isEmpty()
        .isNumeric(),
], blogsController.deleteBlog);
blogRouter.delete('/delete_comment', [
    express_validator_1.check('commentId')
        .not()
        .isEmpty()
        .isNumeric(),
], commentController.deleteComment);
module.exports = blogRouter;
//# sourceMappingURL=blog-routes.js.map