"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const boardControllers = __importStar(require("../controllers/board-controllers"));
const projectControllers = require('../controllers/project-controllers');
const projectRouter = express_1.default.Router();
projectRouter.post('/boards/add_task', [
    express_validator_1.check('taskTitle')
        .not()
        .isEmpty(),
    express_validator_1.check('taskColumnId')
        .not()
        .isEmpty(),
], boardControllers.addTaskToBoard);
projectRouter.get('/', projectControllers.getProjects);
projectRouter.get('/boards/:bid', boardControllers.getBoardById);
projectRouter.post('/create_project', [
    express_validator_1.check('title')
        .not()
        .isEmpty(),
    express_validator_1.check('link')
        .not()
        .isEmpty(),
    express_validator_1.check('description')
        .not()
        .isEmpty(),
    express_validator_1.check('private')
        .not()
        .isEmpty(),
], projectControllers.createProject);
projectRouter.post('/vote_project', [
    express_validator_1.check('vote')
        .not()
        .isEmpty()
        .isNumeric(),
    express_validator_1.check('projectId')
        .not()
        .isEmpty()
        .isNumeric(),
], projectControllers.voteProject);
projectRouter.post('/add_user', [
    express_validator_1.check('projectId')
        .not()
        .isEmpty()
        .isNumeric(),
    express_validator_1.check('userId')
        .not()
        .isEmpty()
        .isNumeric(),
], projectControllers.addProjectCollaborator);
projectRouter.delete('/delete_project', [
    express_validator_1.check('projectId')
        .not()
        .isEmpty()
        .isNumeric(),
], projectControllers.deleteProject);
projectRouter.get('/boards/tasks/:tid', boardControllers.getTaskById);
projectRouter.get('/collaborators', projectControllers.getProjectCollaborators);
projectRouter.get('/:pid', projectControllers.getProjectById);
projectRouter.post('/boards/tasks/add_user', [
    express_validator_1.check('userId')
        .not()
        .isEmpty()
        .isNumeric(),
    express_validator_1.check('taskId')
        .not()
        .isEmpty()
        .isNumeric(),
], boardControllers.addCollaboratorToTask);
projectRouter.delete('/boards/tasks/remove_user', [
    express_validator_1.check('userId')
        .not()
        .isEmpty()
        .isNumeric(),
    express_validator_1.check('taskId')
        .not()
        .isEmpty()
        .isNumeric(),
], boardControllers.removeCollaboratorFromTask);
projectRouter.put('/boards/update_task', [
    express_validator_1.check('title')
        .not()
        .isEmpty(),
    express_validator_1.check('task_id')
        .not()
        .isEmpty()
        .isNumeric(),
], boardControllers.updateTask);
projectRouter.put('/boards/update_task_position', [
    express_validator_1.check('column_id')
        .not()
        .isEmpty()
        .isNumeric(),
    express_validator_1.check('task_id')
        .not()
        .isEmpty()
        .isNumeric(),
], boardControllers.updateTaskPosition);
projectRouter.put('/update_project', [
    express_validator_1.check('projectId')
        .not()
        .isEmpty()
        .isNumeric(),
    express_validator_1.check('title')
        .not()
        .isEmpty(),
    express_validator_1.check('description')
        .not()
        .isEmpty(),
    express_validator_1.check('link')
        .not()
        .isEmpty(),
    express_validator_1.check('privateProject').isBoolean(),
], projectControllers.updateProject);
projectRouter.put('/boards/update_column', [
    express_validator_1.check('title')
        .not()
        .isEmpty(),
    express_validator_1.check('columnId')
        .not()
        .isEmpty()
        .isNumeric(),
], boardControllers.updateColumn);
projectRouter.delete('/boards/tasks/delete_task', [
    express_validator_1.check('taskId')
        .not()
        .isEmpty()
        .isNumeric(),
], boardControllers.deleteTask);
projectRouter.delete('/remove_collaborator', [
    express_validator_1.check('projectId')
        .not()
        .isEmpty()
        .isNumeric(),
    express_validator_1.check('userId')
        .not()
        .isEmpty()
        .isNumeric(),
], projectControllers.removeProjectCollaborator);
module.exports = projectRouter;
//# sourceMappingURL=project-routes.js.map