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
    resourceController.addTagToResource
);

router.post(
    '/vote_resource',
    resourceController.voteResource
);

router.delete(
    '/delete_resource',
    resourceController.deleteResource
);

router.put(
    '/update_resource',
    resourceController.updateResource
);


module.exports = router;