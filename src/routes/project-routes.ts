import express from 'express';
import { check } from 'express-validator';

const projectControllers = require('../controllers/project-controllers');
const projectRouter = express.Router();

projectRouter.post(
	'/boards/add_task',
	[
		check('taskTitle')
			.not()
			.isEmpty(),
		check('taskColumnId')
			.not()
			.isEmpty(),
	],
	projectControllers.addTaskToBoard,
);

projectRouter.get('/', projectControllers.getProjects);

projectRouter.get('/boards/:bid', projectControllers.getBoardById);

projectRouter.post('/create_project', projectControllers.createProject);

projectRouter.post(
	'/vote_project',
	[
		check('vote')
			.not()
			.isEmpty()
			.isNumeric(),
		check('projectId')
			.not()
			.isEmpty()
			.isNumeric(),
	],
	projectControllers.voteProject,
);

projectRouter.post(
	'/add_user',
	[
		check('projectId')
			.not()
			.isEmpty()
			.isNumeric(),
		check('userId')
			.not()
			.isEmpty()
			.isNumeric(),
	],
	projectControllers.addProjectCollaborator,
);

projectRouter.delete(
	'/delete_project',
	[
		check('projectId')
			.not()
			.isEmpty()
			.isNumeric(),
	],
	projectControllers.deleteProject,
);

projectRouter.get('/boards/tasks/:tid', projectControllers.getTaskById);

projectRouter.get('/collaborators', projectControllers.getProjectCollaborators);

projectRouter.get('/:pid', projectControllers.getProjectById);

projectRouter.post(
	'/boards/tasks/add_user',
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
	projectControllers.addCollaboratorToTask,
);

projectRouter.put(
	'/boards/update_task',
	[
		check('title')
			.not()
			.isEmpty(),
		check('task_id')
			.not()
			.isEmpty()
			.isNumeric(),
	],
	projectControllers.updateTask,
);

projectRouter.put(
	'/boards/update_task_position',
	[
		check('column_id')
			.not()
			.isEmpty()
			.isNumeric(),
		check('task_id')
			.not()
			.isEmpty()
			.isNumeric(),
	],
	projectControllers.updateTaskPosition,
);

projectRouter.put(
	'/update_project',
	[
		check('projectId')
			.not()
			.isEmpty()
			.isNumeric(),
		check('title')
			.not()
			.isEmpty(),
		check('description')
			.not()
			.isEmpty(),
		check('link')
			.not()
			.isEmpty(),
		check('privateProject').isBoolean(),
	],
	projectControllers.updateProject,
);

projectRouter.put(
	'/boards/update_column',
	[
		check('title')
			.not()
			.isEmpty(),
		check('columnId')
			.not()
			.isEmpty()
			.isNumeric(),
	],
	projectControllers.updateColumn,
);

projectRouter.delete(
	'/boards/tasks/delete_task',
	[
		check('taskId')
			.not()
			.isEmpty()
			.isNumeric(),
	],
	projectControllers.deleteTask,
);

module.exports = projectRouter;
