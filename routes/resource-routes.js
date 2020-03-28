const express = require('express');
const router = express.Router();
const { check } = require('express-validator');

const resourceController = require('../controllers/resource-controllers');

router.get('/', resourceController.getResources);

router.get('/tags', resourceController.searchTags);

router.get('/:rid', resourceController.getResourceById);

router.post(
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

router.post(
	'/save_resource',
	[
		check('rId')
			.not()
			.isEmpty()
			.isNumeric(),
	],
	resourceController.saveResource,
);

router.delete(
	'/save_resource',
	[
		check('rId')
			.not()
			.isEmpty()
			.isNumeric(),
	],
	resourceController.unSaveResource,
);

router.post(
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

router.post(
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

router.delete(
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

router.delete(
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

router.put(
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

module.exports = router;
