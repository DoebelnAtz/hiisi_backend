const express = require('express');
const router = express.Router();
const { check } = require('express-validator');

const resourceController = require('../controllers/resources-controllers');

router.get('/', resourceController.getResources);

router.get('/tags', resourceController.searchTags);

router.get('/:rid', resourceController.getResourceById);

router.post(
	'/add_resource',
	[
		check('userId')
			.not()
			.isEmpty()
			.isNumeric(),
		check('taskId')
			.not()
			.isEmpty()
			.isNumeric(),
	],
	resourceController.addResource,
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

router.delete('/delete_resource', resourceController.deleteResource);

router.delete('/delete_tag', resourceController.deleteTagFromResource);

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
