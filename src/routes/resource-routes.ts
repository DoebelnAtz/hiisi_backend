import express from 'express';
import { check } from 'express-validator';

const resourceRouter = express.Router();
const resourceController = require('../controllers/resource-controllers');

resourceRouter.get('/', resourceController.getResources);

resourceRouter.get('/tags', resourceController.searchTags);

resourceRouter.get('/:rid', resourceController.getResourceById);

resourceRouter.post(
	'/add_resource',
	[
		check('title')
			.not()
			.isEmpty(),
		check('link')
			.not()
			.isEmpty(),
		check('description')
			.not()
			.isEmpty(),
		check('type')
			.not()
			.isEmpty(),
	],
	resourceController.createResource,
);

resourceRouter.post(
	'/create_tag',
	[
		check('tagTitle')
			.not()
			.isEmpty(),
	],
	resourceController.createTag,
);

resourceRouter.post(
	'/save_resource',
	[
		check('rId')
			.not()
			.isEmpty()
			.isNumeric(),
	],
	resourceController.saveResource,
);

resourceRouter.delete(
	'/save_resource',
	[
		check('rId')
			.not()
			.isEmpty()
			.isNumeric(),
	],
	resourceController.unSaveResource,
);

resourceRouter.post(
	'/add_tags',
	[
		check('tag.tag_id')
			.not()
			.isEmpty()
			.isNumeric(),
		check('rId')
			.not()
			.isEmpty()
			.isNumeric(),
	],
	resourceController.addTagToResource,
);

resourceRouter.post(
	'/vote_resource',
	[
		check('vote')
			.not()
			.isEmpty()
			.isNumeric(),
		check('resourceId')
			.not()
			.isEmpty()
			.isNumeric(),
	],
	resourceController.voteResource,
);

resourceRouter.delete(
	'/delete_resource',
	[
		check('userId')
			.not()
			.isEmpty()
			.isNumeric(),
		check('resourceId')
			.not()
			.isEmpty()
			.isNumeric(),
	],
	resourceController.deleteResource,
);

resourceRouter.delete(
	'/delete_tag',
	[
		check('tagId')
			.not()
			.isEmpty()
			.isNumeric(),
		check('rId')
			.not()
			.isEmpty()
			.isNumeric(),
	],
	resourceController.deleteTagFromResource,
);

resourceRouter.put(
	'/update_resource',
	[
		check('resource.description')
			.not()
			.isEmpty(),
		check('resource.link')
			.not()
			.isEmpty(),
		check('resource.title')
			.not()
			.isEmpty(),
		check('resource.r_id')
			.not()
			.isEmpty()
			.isNumeric(),
	],
	resourceController.updateResource,
);

module.exports = resourceRouter;
