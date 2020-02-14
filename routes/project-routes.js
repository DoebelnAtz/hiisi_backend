const express = require('express');
const projectControllers = require('../controllers/project-controllers');
const { check } = require('express-validator');
const router = express.Router();

router.post(
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

router.get('/boards/:bid', projectControllers.getBoardById);

router.post('/boards/save_board', projectControllers.saveBoardState);

router.post('/create_project', projectControllers.createProject);

router.get('/:pid', projectControllers.getProjectById);

router.get('/boards/tasks/:tid', projectControllers.getTaskById);

router.post(
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

router.get('/', projectControllers.getProjects);

router.put('/boards/update_task', projectControllers.updateTask);

router.put(
	'/boards/update_task_position',
	projectControllers.updateTaskPosition,
);

router.put(
	'/boards/update_column_title',
	[
		check('title')
			.not()
			.isEmpty(),
		check('columnId')
			.not()
			.isEmpty()
			.isNumeric(),
	],
	projectControllers.updateColumnTitle,
);

module.exports = router;
