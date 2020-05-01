"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const catchErrors_1 = require("../errors/catchErrors");
const customError_1 = __importDefault(require("../errors/customError"));
const { validationResult } = require('express-validator');
const { errorLogger } = require('../logger');
const queries_1 = __importDefault(require("../postgres/queries"));
const transaction_1 = require("../errors/transaction");
exports.createProject = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.decoded.u_id;
    const { title, link, description, private: privateProject } = req.body;
    let createdProject;
    const client = yield queries_1.default.connect();
    try {
        yield client.query('BEGIN');
        let commentthread = yield client.query(`INSERT INTO commentthreads DEFAULT VALUES 
			RETURNING t_id`);
        commentthread = commentthread.rows[0];
        let chatthread = yield client.query(`INSERT INTO 
			threads (thread_name, project_thread)
			 VALUES ($1, true) 
			RETURNING t_id`, [title]);
        chatthread = chatthread.rows[0];
        createdProject = yield client.query(`INSERT INTO projects 
			(title, description, link, t_id, commentthread, creator, private) 
			VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`, [
            title,
            description,
            link,
            chatthread.t_id,
            commentthread.t_id,
            userId,
            privateProject,
        ]);
        createdProject = createdProject.rows[0];
        let board = yield client.query(`INSERT INTO boards (title, project_id) 
			VALUES ($1, $2) RETURNING board_id`, [title, createdProject.project_id]);
        board = board.rows[0];
        let boardTitles = [
            'Backlog',
            'Breakdown',
            'In Development',
            'Testing',
            'Implementing',
        ];
        for (var i = 0; i < 5; i++) {
            yield client.query(`INSERT INTO boardcolumns 
				(board_id, title, wip_limit) VALUES 
				($1, $2, ${!i ? null : 2})`, [board.board_id, boardTitles[i]]);
        }
        yield client.query(`INSERT INTO projectcollaborators 
			(u_id, project_id) VALUES ($1, $2) RETURNING
			project_id, u_id`, [userId, createdProject.project_id]);
        yield client.query(`INSERT INTO threadconnections 
			(user_id, thread_id) VALUES ($1, $2)`, [userId, chatthread.t_id]);
        let collaborators = yield client.query(`SELECT u.username, u.profile_pic, u.u_id
			FROM users u JOIN projectcollaborators c ON c.u_id = u.u_id 
			WHERE c.project_id = $1`, [createdProject.project_id]);
        collaborators = collaborators.rows;
        createdProject = Object.assign(Object.assign({}, createdProject), { collaborators: collaborators });
        yield client.query('COMMIT');
    }
    catch (e) {
        yield client.query('ROLLBACK');
        errorLogger.error(`Failed to create project: ${e} | Err: ${e.code}`);
        if (e.code === '23505') {
            throw new customError_1.default('Failed to create project: Title already exists', 400);
        }
        throw new Error('Failed to create project');
    }
    finally {
        client.release();
    }
    res.json(createdProject);
}), 'Failed to create project');
exports.getProjects = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = req.query.page || 1;
    const userId = req.decoded.u_id;
    const order = req.query.order || 'popular';
    const reverse = req.query.reverse || 'false';
    if (order !== 'popular' && order !== 'recent' && order !== 'title') {
        errorLogger.error('Failed to get projects: invalid order parameter');
        return res.status(422).json({
            status: 'error',
            message: 'Failed to get resources',
        });
    }
    let order1;
    let order2;
    let reverseOrder;
    switch (order) {
        case 'popular':
            reverseOrder = reverse === 'true' ? 'ASC' : 'DESC';
            order1 = `votes ${reverseOrder}`;
            order2 = 'p.published_date DESC';
            break;
        case 'recent':
            reverseOrder = reverse === 'true' ? 'ASC' : 'DESC';
            order1 = `p.published_date ${reverseOrder}`;
            order2 = 'votes DESC';
            break;
        default:
            reverseOrder = reverse === 'true' ? 'DESC' : 'ASC';
            order1 = `p.title ${reverseOrder}`;
            order2 = 'p.published_date DESC';
    }
    const perPage = 14;
    let projects = yield queries_1.default.query(`SELECT p.title, p.published_date, u.username, p.creator, p.private,
			COALESCE(vs.votes, 0) AS votes, p.project_id, v.vote, collab.collaborators
			FROM projects p JOIN users u ON p.creator = u.u_id 
			LEFT JOIN (SELECT vote, project_id FROM projectvotes WHERE u_id = $1) v 
			ON v.project_id = p.project_id
			LEFT JOIN (SELECT project_id, SUM(vote) AS votes FROM projectvotes
			GROUP BY project_id) vs
			ON vs.project_Id = p.project_id 
			LEFT JOIN (
			SELECT pc.project_id, array_agg(cu.profile_pic) AS collaborators, array_agg(cu.u_id) AS auth_users 
			FROM users cu 
			JOIN projectcollaborators pc ON pc.u_id = cu.u_id GROUP BY pc.project_id
			) collab ON collab.project_id = p.project_id WHERE $1 = ANY (auth_users) OR p.private = false
			ORDER BY ${order1}, ${order2} LIMIT $2 OFFSET $3`, [userId, perPage, (page - 1) * perPage]);
    projects = projects.rows;
    res.json(projects);
}), 'Failed to get projects');
exports.getProjectById = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const projectId = req.params.pid;
    const userId = req.decoded.u_id;
    let contributor = false;
    let project = yield queries_1.default.query(`SELECT p.title, p.commentthread, p.creator,
				b.board_id, p.project_id, p.votes, p.t_id, p.private,
				p.description, p.link, p.published_date
				FROM projects p JOIN boards b 
				ON b.project_id = p.project_id AND p.project_id = $1`, [projectId]);
    project = project.rows[0];
    let collaborators = yield queries_1.default.query('SELECT u.username, u.u_id, u.profile_pic FROM users u ' +
        'JOIN projectcollaborators c ON c.u_id = u.u_id AND c.project_id = $1', [projectId]);
    collaborators = collaborators.rows;
    for (var i = 0; i < collaborators.length; i++) {
        if (collaborators[i].u_id === userId)
            contributor = true;
    }
    res.json(Object.assign(Object.assign({}, project), { contributor, collaborators }));
}), 'Failed to get project by id');
exports.getProjectCollaborators = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let projectId = req.query.projectId;
    let collaborators = yield queries_1.default.query(`SELECT u.username, u.profile_pic, u.u_id
	        FROM users u JOIN projectcollaborators c
	        ON c.u_id = u.u_id WHERE c.project_id = $1`, [projectId]);
    collaborators = collaborators.rows;
    res.json(collaborators);
}), 'Failed to get project collaborators');
exports.updateProject = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { projectId, title, description, link, privateProject } = req.body;
    const client = yield queries_1.default.connect();
    try {
        yield client.query('BEGIN');
        yield client.query(`UPDATE projects SET title = $1, description = $2, link = $3, private = $4 WHERE project_id = $5`, [title, description, link, privateProject, projectId]);
        yield client.query('COMMIT');
    }
    catch (e) {
        yield client.query('ROLLBACK');
        throw new customError_1.default(`Failed to update project`, 500, e);
    }
    finally {
        client.release();
    }
    res.json({ title: title, description: description });
}), 'Failed to update project');
exports.voteProject = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let { vote, projectId } = req.body;
    const userId = req.decoded.u_id;
    let voteTarget = yield queries_1.default.query(`SELECT u_id, vote, project_id FROM projectvotes WHERE project_id = $1 AND u_id = $2`, [projectId, userId]);
    voteTarget = voteTarget.rows[0];
    const client = yield queries_1.default.connect();
    try {
        yield client.query('BEGIN');
        if (!!voteTarget) {
            switch (vote) {
                case 0:
                    vote = -voteTarget.vote;
                    yield client.query(`DELETE FROM projectvotes 
                            WHERE project_id = $1 AND u_id = $2`, [projectId, userId]);
                    break;
                case 1:
                    vote = 2;
                    yield client.query(`UPDATE projectvotes 
                            SET vote = 1 
                            WHERE project_id = $1 AND u_id = $2`, [projectId, userId]);
                    break;
                case -1:
                    vote = -2;
                    yield client.query(`UPDATE projectvotes 
                            SET vote = -1 
                            WHERE project_id = $1 AND u_id = $2`, [projectId, userId]);
                    break;
                default:
                    throw new Error('Failed to vote on project');
            }
        }
        else {
            yield client.query(`INSERT INTO 
                    projectvotes (project_id, u_id, vote) 
                    VALUES ($1, $2, $3)`, [projectId, userId, vote]);
        }
        yield client.query('COMMIT');
    }
    catch (e) {
        yield client.query('ROLLBACK');
        throw new Error('Failed to vote on project');
    }
    finally {
        client.release();
    }
    res.json({ success: true });
}), 'Failed to vote on project');
exports.removeProjectCollaborator = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, projectId } = req.body;
    const senderId = req.decoded.u_id;
    let targetProject;
    let senderCollaborator = yield queries_1.default.query(`SELECT project_id FROM projects WHERE creator = $1 AND project_id = $2`, [senderId, projectId]);
    if (!senderCollaborator.rows.length) {
        throw new customError_1.default('Failed to add user to project: unauthorized sender', 403);
    }
    if (senderId === userId) {
        throw new customError_1.default(`Failed to add user to project: can't delete project owner`, 422);
    }
    targetProject = yield queries_1.default.query(`SELECT project_id, t_id FROM projects WHERE project_id = $1`, [projectId]);
    targetProject = targetProject.rows;
    if (!targetProject.length) {
        throw new customError_1.default('Failed to add user to project: no project found matching given id', 404);
    }
    else {
        targetProject = targetProject[0];
    }
    const client = yield queries_1.default.connect();
    yield transaction_1.transaction(() => __awaiter(void 0, void 0, void 0, function* () {
        yield client.query(`DELETE FROM threadconnections WHERE thread_id = $1 AND user_id = $2`, [targetProject.t_id, userId]);
        yield client.query('DELETE FROM projectcollaborators WHERE project_id = $1 AND u_id = $2', [projectId, userId]);
    }), client, 'Failed to remove collaborator from project');
    res.json({ success: true });
}), 'Failed to remove collaborator from project');
exports.addProjectCollaborator = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, projectId } = req.body;
    const senderId = req.decoded.u_id;
    let senderCollaborator;
    let targetProject;
    let targetUser = yield queries_1.default.query(`SELECT username, u_id, profile_pic FROM users WHERE u_id = $1`, [userId]);
    targetUser = targetUser.rows[0];
    senderCollaborator = yield queries_1.default.query(`SELECT u_id, project_id FROM projectcollaborators WHERE u_id = $1 AND project_id = $2`, [senderId, projectId]);
    senderCollaborator = senderCollaborator.rows;
    if (!senderCollaborator.length) {
        throw new customError_1.default('Failed to add user to project: unauthorized sender', 403);
    }
    targetProject = yield queries_1.default.query(`SELECT project_id, t_id FROM projects WHERE project_id = $1`, [projectId]);
    targetProject = targetProject.rows;
    if (!targetProject.length) {
        throw new customError_1.default('Failed to add user to project: no project found matching given id', 404);
    }
    else {
        targetProject = targetProject[0];
    }
    const client = yield queries_1.default.connect();
    try {
        yield client.query('BEGIN');
        yield client.query(`INSERT INTO threadconnections (thread_id, user_id) VALUES ($1, $2)`, [targetProject.t_id, userId]);
        yield client.query(`INSERT INTO projectcollaborators (project_id, u_id) VALUES ($1, $2)`, [projectId, userId]);
        yield client.query('COMMIT');
    }
    catch (e) {
        yield client.query('ROLLBACK');
        throw new Error('Failed to add user to project');
    }
    finally {
        client.release();
    }
    res.json(targetUser);
}), 'Failed to add user to project');
exports.deleteProject = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({
            status: 'error',
            message: 'Invalid input please try again.',
        });
    }
    const senderId = req.decoded.u_id;
    const { projectId } = req.body;
    let targetProject;
    try {
        targetProject = yield queries_1.default.query(`
        	SELECT from PROJECTS WHERE project_id = $1 AND creator = $2
        `, [projectId, senderId]);
        targetProject = targetProject.rows;
        if (!targetProject.length) {
            errorLogger.error("Failed to delete project: Couldn't find project with the provided id.");
            return res.status(404).json({
                status: 'error',
                message: "Failed to delete project: Couldn't find project with the provided id",
            });
        }
        else {
            targetProject = targetProject[0];
        }
    }
    catch (e) {
        errorLogger.error('Failed to delete project: ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to delete project',
        });
    }
    const client = yield queries_1.default.connect();
    try {
        yield client.query('BEGIN');
        if (targetProject.t_id) {
            yield client.query(`
                DELETE FROM threads WHERE t_id = $1
            `, targetProject.t_id);
        }
        yield client.query(`
            DELETE FROM projects WHERE project_id = $1
        `, [projectId]);
        yield client.query('COMMIT');
    }
    catch (e) {
        yield client.query('ROLLBACK');
        throw new Error('Failed to delete project');
    }
    finally {
        client.release();
    }
    res.json({ success: true });
}), 'Failed to delete project');
//# sourceMappingURL=project-controllers.js.map