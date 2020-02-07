const express = require('express');
const router = express.Router();

const resourceController = require('../controllers/resources-controllers');

router.get(
    '/',
    resourceController.getResources
);

router.get(
    '/tags',
    resourceController.searchTags
);

router.get(
    '/:rid',
    resourceController.getResourceById
);

router.post(
    '/add_resource',
    resourceController.addResource
);

router.post(
    '/add_tags',
    resourceController.addTagsToResource
);

router.delete(
    '/delete_resource',
    resourceController.deleteResource
);

module.exports = router;