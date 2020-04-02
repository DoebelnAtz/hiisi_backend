import { check } from 'express-validator';

const express = require('express');

const blogsController = require('../controllers/blog-controllers');
const commentController = require('../controllers/comment-controllers');
const blogRouter = express.Router();

// We can get posts by POST or GET, POST method can include senderId to check if sender has liked a post

blogRouter.get('/', blogsController.getBlogs);

blogRouter.get('/:bid', blogsController.getBlogById);

blogRouter.get('/users/:uid', blogsController.getBlogsByUserId);

// Same as blogs, we can get comment threads by POST or GET to check likes,

blogRouter.get('/commentthread/:tid', commentController.getCommentThreadById);

blogRouter.post(
	'/create_blog',
	[
		check('title')
			.not()
			.isEmpty(),
		check('content')
			.not()
			.isEmpty(),
	],
	blogsController.createBlog,
);

blogRouter.post(
	'/vote_blog',
	[
		check('blogId')
			.not()
			.isEmpty()
			.isNumeric(),
		check('vote')
			.not()
			.isEmpty()
			.isNumeric(),
	],
	blogsController.voteBlog,
);

blogRouter.post(
	'/create_comment',
	[
		check('threadId')
			.not()
			.isEmpty()
			.isNumeric(),
		check('content')
			.not()
			.isEmpty(),
	],
	commentController.createComment,
);

blogRouter.put(
	'/update_blog',
	[
		check('content')
			.not()
			.isEmpty(),
		check('title')
			.not()
			.isEmpty(),
		check('blogId')
			.not()
			.isEmpty(),
	],
	blogsController.updateBlog,
);

blogRouter.delete(
	'/delete_blog',
	[
		check('blogId')
			.not()
			.isEmpty()
			.isNumeric(),
	],
	blogsController.deleteBlog,
);

blogRouter.delete(
	'/delete_comment',
	[
		check('commentId')
			.not()
			.isEmpty()
			.isNumeric(),
	],
	commentController.deleteComment,
);

module.exports = blogRouter;
