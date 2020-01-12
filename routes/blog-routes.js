const express = require('express');
const { check } = require('express-validator');

const blogsController = require('../controllers/blog-controllers');
const commentController = require('../controllers/comment-controllers');
const router = express.Router();

router.get(
    '/',
    blogsController.getBlogs
);

router.get(
    '/:bid',
    blogsController.getBlogById
);

router.get(
    '/users/:uid',
    blogsController.getBlogsByUserId
);

router.post(
    '/create_blog',
    [
        check('title')
            .not()
            .isEmpty(),
        check('content')
            .not()
            .isEmpty(),
    ],
    blogsController.createBlog
);

router.post(
    '/create_comment',
    [
        check('authorId')
            .not()
            .isEmpty(),
        check('postId')
            .not()
            .isEmpty(),
        check('content')
            .not()
            .isEmpty(),
    ],
    commentController.createComment
);

module.exports = router;