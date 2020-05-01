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
const logger_1 = require("../logger");
const queries_1 = __importDefault(require("../postgres/queries"));
const transaction_1 = require("../errors/transaction");
const urlMetadata = require('url-metadata');
var URL = require('url').URL;
exports.getResources = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.decoded.u_id;
    const page = req.query.page || 1;
    const filter = req.query.filter || 'none';
    const show = req.query.show || 'all';
    const order = req.query.order || 'popular';
    const reverse = req.query.reverse || 'false';
    if (order !== 'popular' && order !== 'recent' && order !== 'title') {
        throw new customError_1.default('Invalid query parameters', 422);
    }
    let order1;
    let order2;
    let reverseOrder;
    switch (order) {
        case 'popular':
            reverseOrder = reverse === 'true' ? 'ASC' : 'DESC';
            order1 = `votes ${reverseOrder}`;
            order2 = 'r.published_date DESC';
            break;
        case 'recent':
            reverseOrder = reverse === 'true' ? 'ASC' : 'DESC';
            order1 = `r.published_date ${reverseOrder}`;
            order2 = 'votes DESC';
            break;
        default:
            reverseOrder = reverse === 'true' ? 'DESC' : 'ASC';
            order1 = `r.title ${reverseOrder}`;
            order2 = 'r.published_date DESC';
    }
    let resources;
    const perPage = 14;
    resources = yield queries_1.default.query(`SELECT vc.vote, u.username, u.profile_pic, u.u_id, u.u_id, sr.u_id IS NOT NULL AS saved,
			COALESCE(rv.votes, 0) AS votes, r.title, 
			r.r_id, r.link, r.published_date, r.edited,  r.thumbnail, r.resource_type,
			c.tags, c.colors 
			FROM resources r 
			${show === 'saved' ? 'JOIN ' : 'LEFT JOIN '}
					saved_resources sr
					ON sr.r_id = r.r_id AND sr.u_id = $1
			JOIN users u ON r.author = u.u_id 
				${show === 'submitted' ? `AND r.author = $1` : ''}
			LEFT JOIN (
				SELECT c.r_id, 
				array_agg(t.title) AS tags, 
				array_agg(t.color) AS colors 
				FROM tagconnections c 
				JOIN tags t 
				ON t.tag_id = c.tag_id 
				GROUP BY c.r_id
			) c ON c.r_id = r.r_id
			LEFT JOIN (SELECT r_id, SUM(vote) 
			AS votes FROM resourcevotes GROUP BY r_id) rv
			ON rv.r_id = r.r_id
			LEFT JOIN resourcevotes vc ON vc.r_id = r.r_id AND vc.u_id = $1 
			${filter !== 'none' ? 'AND vc.u_id = $1 WHERE $4 = ANY (tags)' : ''}
			ORDER BY ${order1}, ${order2} LIMIT $2 OFFSET $3`, filter === 'none'
        ? [userId, perPage, (page - 1) * perPage]
        : [userId, perPage, (page - 1) * perPage, filter]);
    resources = resources.rows.map((r) => {
        return Object.assign(Object.assign({}, r), { owner: Number(r.u_id) === Number(userId) });
    });
    res.json(resources);
}), 'Failed to get resources');
exports.saveResource = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { rId } = req.body;
    const senderId = req.decoded.u_id;
    const client = yield queries_1.default.connect();
    try {
        yield client.query('BEGIN');
        yield client.query(`INSERT INTO saved_resources (r_id, u_id)
			VALUES ($1, $2)`, [rId, senderId]);
        yield client.query('COMMIT');
    }
    catch (e) {
        yield client.query('ROLLBACK');
        logger_1.errorLogger.error('Failed to save resource: ' + e);
        return res.status(500).json({
            success: false,
            status: 'error',
            message: 'Failed to save resource.',
        });
    }
    finally {
        client.release();
    }
    res.json({ success: true });
}), 'Failed to save resource');
exports.unSaveResource = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { rId } = req.body;
    const senderId = req.decoded.u_id;
    const client = yield queries_1.default.connect();
    try {
        yield client.query('BEGIN');
        yield client.query(`DELETE FROM saved_resources WHERE r_id = $1 AND u_id = $2`, [rId, senderId]);
        yield client.query('COMMIT');
    }
    catch (e) {
        yield client.query('ROLLBACK');
        throw new customError_1.default('Failed to un-save resource', 500, e);
    }
    finally {
        client.release();
    }
    res.json({ success: true });
}), 'Failed to un-save resource');
exports.deleteTagFromResource = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { tagId, rId } = req.body;
    yield queries_1.default.query(`DELETE from tagconnections WHERE tag_id = $1 
		AND r_id = $2`, [tagId, rId]);
    res.json({ success: true });
}), 'Failed to delete tag from resource');
exports.addTagToResource = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { tag, rId } = req.body;
    const client = yield queries_1.default.connect();
    try {
        yield client.query('BEGIN');
        yield client.query('INSERT INTO tagconnections (tag_id, r_id) ' +
            'VALUES ($1, $2) RETURNING tag_id, r_id', [tag.tag_id, rId]);
        yield client.query('COMMIT');
    }
    catch (e) {
        yield client.query('ROLLBACK');
        logger_1.errorLogger.error('Failed to add tags: ' + e);
        return res.status(500).json({
            success: false,
            status: 'error',
            message: 'Failed to add tags.',
        });
    }
    finally {
        client.release();
    }
    res.json(tag);
}), 'Failed to add tag');
exports.getResourceById = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const resourceId = req.params.rid;
    const senderId = req.decoded.u_id;
    let resource = yield queries_1.default.query(`SELECT r.r_id, r.title, r.link, r.description, 
            r.author, r.votes, r.published_date, r.commentthread, r.thumbnail, 
            u.profile_pic, u.u_id, u.username 
            FROM resources r JOIN users u ON u.u_id = r.author 
            WHERE r.r_id = $1`, [resourceId]);
    resource = Object.assign(Object.assign({}, resource.rows[0]), { owner: resource.rows[0].u_id === senderId });
    let tags = yield queries_1.default.query('SELECT t.title, t.tag_id, t.color FROM ' +
        'tags t JOIN tagconnections c ' +
        'ON t.tag_id = c.tag_id WHERE c.r_id = $1', [resourceId]);
    tags = tags.rows;
    resource = Object.assign(Object.assign({}, resource), { tags: tags });
    res.json(resource);
}), 'Failed to get tags for resource');
exports.createResource = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const client = yield queries_1.default.connect();
    const { title, description, link, type } = req.body;
    const userId = req.decoded.u_id;
    let md;
    try {
        md = yield urlMetadata(link);
        console.log(md);
    }
    catch (e) {
        md = '';
    }
    let mdImage = md['og:image'];
    if (mdImage) {
        try {
            new URL(mdImage);
        }
        catch (e) {
            let newLink = new URL(link);
            mdImage = newLink.origin + mdImage;
            try {
                new URL(mdImage);
            }
            catch (e) {
                mdImage = null;
            }
        }
    }
    else {
        mdImage = null;
    }
    let createdResource;
    try {
        yield client.query('BEGIN');
        let t_id = yield client.query('INSERT INTO commentthreads DEFAULT VALUES RETURNING t_id');
        t_id = t_id.rows[0].t_id;
        createdResource = yield client.query(`WITH inserted as (
				INSERT INTO resources (title, thumbnail, description, link, commentthread, author, resource_type)
				VALUES ($1, $2, $3, $4, $5, $6, $7)
				RETURNING *) 
				SELECT i.r_id, i.title, i.thumbnail, i.resource_type,
				i.link, i.author, i.votes, i.published_date, i.commentthread, 
				u.profile_pic, u.username, u.u_id 
				FROM inserted i JOIN users u ON u.u_id = i.author WHERE u.u_id = $6`, [title, mdImage, description, link, t_id, userId, type]);
        createdResource = Object.assign(Object.assign({}, createdResource.rows[0]), { tags: [] });
        yield client.query('COMMIT');
    }
    catch (e) {
        yield client.query('ROLLBACK');
        logger_1.errorLogger.error('Failed to add Resource to DB: ' + e + e.code);
        if (e.code === '23505') {
            res.status(400).json({
                success: false,
                status: 'error',
                message: 'Title already exists',
            });
        }
        else {
            return res.status(500).json({
                success: false,
                status: 'error',
                message: 'Failed to create resource.',
            });
        }
    }
    finally {
        client.release();
    }
    res.status(201).json(createdResource);
}), 'Failed to create resource');
exports.deleteResource = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const senderId = req.decoded.u_id;
    const { resourceId, userId } = req.body;
    let toDelete;
    toDelete = yield queries_1.default.query('SELECT r.author, r.r_id, r.commentthread FROM resources r WHERE r.r_id = $1', [resourceId]);
    if (!toDelete.rows.length) {
        throw new customError_1.default('Failed to find resource with provided id', 404);
    }
    else if (toDelete.rows[0].author !== senderId || userId !== senderId) {
        throw new customError_1.default('Unauthorized resource deletion', 401);
    }
    toDelete = toDelete.rows[0];
    const client = yield queries_1.default.connect();
    try {
        yield client.query('BEGIN');
        yield client.query('DELETE FROM tagconnections t WHERE t.r_id = $1', [
            resourceId,
        ]);
        yield client.query('DELETE FROM resourcevotes t WHERE t.r_id = $1', [
            resourceId,
        ]);
        yield client.query('DELETE FROM resources WHERE r_id = $1', [
            resourceId,
        ]);
        yield client.query('DELETE FROM commentthreads WHERE t_id = $1', [
            toDelete.commentthread,
        ]);
        yield client.query('COMMIT');
    }
    catch (e) {
        yield client.query('ROLLBACK');
        logger_1.errorLogger.error('Failed to delete resource: ' + e);
        return res.status(500).json({
            success: false,
            status: 'error',
            message: 'Failed to delete resource.',
        });
    }
    finally {
        client.release();
    }
    res.json({ success: true });
}), 'Failed to delete resource');
exports.searchTags = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const query = req.query.q;
    let limit = req.query.limit;
    let tags;
    tags = yield queries_1.default.query('SELECT * FROM tags WHERE LOWER(title) LIKE $1 ORDER BY title ASC LIMIT $2', [query.toLowerCase() + '%', limit]);
    tags = tags.rows;
    res.json(tags);
}), 'Failed to find tags');
exports.createTag = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { tagTitle } = req.body;
    let color = yield queries_1.default.query(`SELECT color, tc_id FROM tagcolors LIMIT 1`);
    if (!color.rows.length) {
        throw new customError_1.default('Failed to create tag', 404, 'Failed to create tag: no more unused colors in database');
    }
    else {
        color = color.rows[0];
    }
    const client = yield queries_1.default.connect();
    let createdTag;
    yield transaction_1.transaction(() => __awaiter(void 0, void 0, void 0, function* () {
        createdTag = yield client.query(`INSERT INTO tags (title, color)
		VALUES ($1, $2) RETURNING *`, [tagTitle, color.color]);
        createdTag = createdTag.rows[0];
        yield client.query(`DELETE FROM tagcolors WHERE tc_id = $1`, [
            color.tc_id,
        ]);
    }), client, 'Failed to create tag');
    res.status(201).json(createdTag);
}));
exports.updateResource = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let { resource } = req.body;
    yield queries_1.default.query(`
	UPDATE resources SET 
	description = $1, 
	link = $2, 
	title = $3,
	edited = NOW() 
	WHERE r_id = $4`, [resource.description, resource.link, resource.title, resource.r_id]);
    res.json({ success: true });
}), 'Failed to update resource');
exports.voteResource = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let { vote, resourceId } = req.body;
    const userId = req.decoded.u_id;
    let voteTarget = yield queries_1.default.query(`SELECT c.vote, c.u_id FROM resourcevotes c WHERE c.r_id = $1 AND c.u_id =$2`, [resourceId, userId]);
    voteTarget = voteTarget.rows[0];
    const client = yield queries_1.default.connect();
    try {
        yield client.query('BEGIN');
        if (!!voteTarget) {
            switch (vote) {
                case 0:
                    vote = -voteTarget.vote;
                    yield client.query(`DELETE FROM resourcevotes 
                            WHERE r_id = $1 AND u_id = $2`, [resourceId, userId]);
                    break;
                case 1:
                    vote = 2;
                    yield client.query(`UPDATE resourcevotes 
                            SET vote = 1 
                            WHERE r_id = $1 AND u_id = $2`, [resourceId, userId]);
                    break;
                case -1:
                    vote = -2;
                    yield client.query(`UPDATE resourcevotes 
                            SET vote = -1 
                            WHERE r_id = $1 AND u_id = $2`, [resourceId, userId]);
                    break;
                default:
                    logger_1.errorLogger.error('Failed to vote resource: Invalid vote input');
                    return res.status(500).json({
                        success: false,
                        status: 'error',
                        message: 'Failed to vote resource.',
                    });
            }
        }
        else {
            yield client.query(`INSERT INTO 
                    resourcevotes (r_id, u_id, vote) 
                   	VALUES ($1, $2, $3)`, [resourceId, userId, vote]);
        }
        yield client.query('COMMIT');
    }
    catch (e) {
        yield client.query('ROLLBACK');
        logger_1.errorLogger.error('Failed to vote resource: ' + e);
        return res.status(500).json({
            success: false,
            status: 'error',
            message: 'Failed to vote resource.',
        });
    }
    finally {
        client.release();
    }
    res.json({ success: true });
}), 'Failed to vote resource');
//# sourceMappingURL=resource-controllers.js.map