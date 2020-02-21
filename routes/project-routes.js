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

router.post('/create_project', projectControllers.createProject);

router.post(
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

router.post(
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
    projectControllers.addProjectCollaborator
);

router.get('/boards/tasks/:tid', projectControllers.getTaskById);

router.get('/collaborators', projectControllers.getProjectCollaborators);



router.get('/:pid', projectControllers.getProjectById);

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

router.put('/boards/update_task',
	[
		check('title')
			.not()
			.isEmpty(),
		check('task_id')
			.not()
			.isEmpty()
			.isNumeric(),
	],
	projectControllers.updateTask);

router.put(
	'/boards/update_task_position',
	[
		check('column_id')
			.not()
			.isEmpty()
			.isNumeric(),
		check('task_id')
			.not()
			.isEmpty()
			.isNumeric(), ],
	projectControllers.updateTaskPosition,
);

router.put(
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
    ],
    projectControllers.updateProject,
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

router.delete(
	'/boards/tasks/delete_task',
    [
        check('taskId')
            .not()
            .isEmpty()
            .isNumeric(),
    ],
	projectControllers.deleteTask
);

module.exports = router;
