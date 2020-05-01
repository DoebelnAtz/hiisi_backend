"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const resourceRouter = express_1.default.Router();
const resourceController = require('../controllers/resource-controllers');
resourceRouter.get('/', resourceController.getResources);
resourceRouter.get('/tags', resourceController.searchTags);
resourceRouter.get('/:rid', resourceController.getResourceById);
resourceRouter.post('/add_resource', [
    express_validator_1.check('title')
        .not()
        .isEmpty(),
    express_validator_1.check('link')
        .not()
        .isEmpty(),
    express_validator_1.check('description')
        .not()
        .isEmpty(),
    express_validator_1.check('type')
        .not()
        .isEmpty(),
], resourceController.createResource);
resourceRouter.post('/create_tag', [
    express_validator_1.check('tagTitle')
        .not()
        .isEmpty(),
], resourceController.createTag);
resourceRouter.post('/save_resource', [
    express_validator_1.check('rId')
        .not()
        .isEmpty()
        .isNumeric(),
], resourceController.saveResource);
resourceRouter.delete('/save_resource', [
    express_validator_1.check('rId')
        .not()
        .isEmpty()
        .isNumeric(),
], resourceController.unSaveResource);
resourceRouter.post('/add_tags', [
    express_validator_1.check('tag.tag_id')
        .not()
        .isEmpty()
        .isNumeric(),
    express_validator_1.check('rId')
        .not()
        .isEmpty()
        .isNumeric(),
], resourceController.addTagToResource);
resourceRouter.post('/vote_resource', [
    express_validator_1.check('vote')
        .not()
        .isEmpty()
        .isNumeric(),
    express_validator_1.check('resourceId')
        .not()
        .isEmpty()
        .isNumeric(),
], resourceController.voteResource);
resourceRouter.delete('/delete_resource', [
    express_validator_1.check('userId')
        .not()
        .isEmpty()
        .isNumeric(),
    express_validator_1.check('resourceId')
        .not()
        .isEmpty()
        .isNumeric(),
], resourceController.deleteResource);
resourceRouter.delete('/delete_tag', [
    express_validator_1.check('tagId')
        .not()
        .isEmpty()
        .isNumeric(),
    express_validator_1.check('rId')
        .not()
        .isEmpty()
        .isNumeric(),
], resourceController.deleteTagFromResource);
resourceRouter.put('/update_resource', [
    express_validator_1.check('resource.description')
        .not()
        .isEmpty(),
    express_validator_1.check('resource.link')
        .not()
        .isEmpty(),
    express_validator_1.check('resource.title')
        .not()
        .isEmpty(),
    express_validator_1.check('resource.r_id')
        .not()
        .isEmpty()
        .isNumeric(),
], resourceController.updateResource);
module.exports = resourceRouter;
//# sourceMappingURL=resource-routes.js.map