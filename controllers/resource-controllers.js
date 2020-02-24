const { validationResult } = require('express-validator');

const db = require('../queries');
const { errorLogger, accessLogger } = require('../logger');

const getResources = async (req, res) => {
	const userId = req.decoded.u_id;

	const page = req.query.page;
	const filter = req.query.filter;
	const order = req.query.order;
	const reverse = req.query.reverse;
	// we are dangerously inserting values into a query so we need to make sure that
	// the order parameter is correct
	if (order !== 'popular' && order !== 'recent' && order !== 'title') {
		errorLogger.error('Failed to get resources: invalid order parameter');
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
			order2 = 'published_date DESC';
			break;
		case 'recent':
			reverseOrder = reverse === 'true' ? 'ASC' : 'DESC';
			order1 = `published_date ${reverseOrder}`;
			order2 = 'votes DESC';
			break;
		default:
			reverseOrder = reverse === 'true' ? 'DESC' : 'ASC';
			order1 = `title ${reverseOrder}`;
			order2 = 'published_date DESC';
	}

	let resources;
	let result =[];
	try {
			let filterQuery = Number(filter) ? `WHERE ${filter} IN (tag_one, tag_two, tag_three)` : '';
			resources = await db.query(
				`SELECT r.r_id, r.tag_one, r.tag_two, r.tag_three, r.title, r.published_date, r.votes, 
				u.username, u.u_id, vc.vote, t.title AS tag_title, t.tag_id, t.color 
				FROM (SELECT title, r_id, tag_one, tag_two, tag_three, votes, published_date, author
				FROM resources ORDER BY ${order1}, ${order2} LIMIT $1  OFFSET $2) r
				LEFT JOIN users u ON u.u_id = r.author 
				LEFT JOIN tags t ON r.tag_one = t.tag_id OR r.tag_two = t.tag_id OR r.tag_three = t.tag_id 
				LEFT JOIN voteconnections vc ON vc.r_id = r.r_id 
				AND vc.u_id = $3 ${filterQuery}`,
				[Number(page) * 10, Number(page - 1) * 10, userId],
			);
			resources = resources.rows;
			let prevId;
			let nextResult = -1;
			for (let i = 0; i < resources.length; i++) {
				if (!result.length || result[nextResult].r_id !== resources[i].r_id) {
					result.push({
						title: resources[i].title,
						r_id: resources[i].r_id,
						vote: resources[i].vote,
						username: resources[i].username,
						u_id: resources[i].u_id,
						votes: resources[i].votes,
						published_date: resources[i].published_date,
						tags: []
					});
					nextResult++;
				}
				if (resources[i].tag_title) {
					result[nextResult].tags.push({
						title: resources[i].tag_title,
						tag_id: resources[i].tag_id,
						color: resources[i].color
					});
				}
			}
		result = result.map((r) => {
			return { ...r, owner: Number(r.u_id) === Number(userId) };
		});
	} catch (e) {
		errorLogger.error('Failed to get resources: ' + e);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to get resources',
		});
	}
	let tags;
	res.json(result);
};

const deleteTagFromResource = async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(422).json({
			status: 'error',
			message: 'Invalid input please try again.',
		});
	}
	const { tagId, rId } = req.body;
	try {
		await db.query(
			`DELETE from tagconnections WHERE tag_id = $1 
			AND r_id = $2`,
			[tagId, rId],
		);
	} catch (e) {
		errorLogger.error('Failed to delete tag from resource: ' + e);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to delete tag from resource',
		});
	}
	res.json({ success: true });
};

const addTagToResource = async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(422).json({
			status: 'error',
			message: 'Invalid input please try again.',
		});
	}
	const { tag, rId } = req.body;

	const client = await db.connect();
	let createdTag;
	try {
		await client.query('BEGIN');

		let created = await client.query(
			'INSERT INTO tagconnections (tag_id, r_id) ' +
				'VALUES ($1, $2) RETURNING tag_id, r_id',
			[tag.tag_id, rId],
		);
		createdTag = created.rows[0];
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		errorLogger.error('Failed to add tags: ' + e);
		return res.status(500).json({
			success: false,
			status: 'error',
			message: 'Failed to add tags.',
		});
	} finally {
		client.release();
	}
	res.json(tag);
};

const getResourceById = async (req, res) => {
	const resourceId = req.params.rid;
	const senderId = req.decoded.u_id;

	let resource;
	try {
		resource = await db.query(
			'SELECT r.r_id, r.title, r.link, r.description, r.author, r.votes, r.published_date, r.commentthread, ' +
				'u.profile_pic, u.u_id, u.username ' +
				'FROM resources r JOIN users u ON u.u_id = r.author ' +
				'WHERE r.r_id = $1',
			[resourceId],
		);
		resource = {
			...resource.rows[0],
			owner: resource.rows[0].u_id === senderId,
		};
	} catch (e) {
		errorLogger.error('Failed to get resource: ' + e);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to get resource',
		});
	}

	let tags;
	try {
		tags = await db.query(
			'SELECT t.title, t.tag_id, t.color FROM ' +
				'tags t JOIN tagconnections c ' +
				'ON t.tag_id = c.tag_id WHERE c.r_id = $1',
			[resourceId],
		);
		tags = tags.rows;
		resource = { ...resource, tags: tags };
	} catch (e) {
		errorLogger.error('Failed to get tags for resource: ' + e);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to get tags for resource',
		});
	}
	res.json(resource);
};

const addResource = async (req, res) => {
	const client = await db.connect();
	const { title, description, link } = req.body;
	const userId = req.decoded.u_id;
	let createdResource;
	try {
		await client.query('BEGIN');
		let t_id = await client.query(
			'INSERT INTO commentthreads DEFAULT VALUES RETURNING t_id',
		);
		t_id = t_id.rows[0].t_id;
		createdResource = await client.query(
			'WITH inserted as (' +
				'INSERT INTO resources (title, description, link, commentthread, author) ' +
				'VALUES ($1, $2, $3, $4, $5)' +
				'RETURNING *) ' +
				'SELECT i.r_id, i.title, ' +
				'i.link, i.author, i.votes, i.published_date, i.commentthread, ' +
				'u.profile_pic, u.username, u.u_id ' +
				'FROM inserted i JOIN users u ON u.u_id = i.author WHERE u.u_id = $5',
			[title, description, link, t_id, userId],
		);
		createdResource = { ...createdResource.rows[0], tags: [] };
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		errorLogger.error('Failed to add Resource to DB: ' + e);
		return res.status(500).json({
			success: false,
			status: 'error',
			message: 'Failed to add Resource to DB.',
		});
	} finally {
		client.release();
	}
	res.status(201).json(createdResource);
};

const deleteResource = async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(422).json({
			status: 'error',
			message: 'Invalid input please try again.',
		});
	}
	const senderId = req.decoded.u_id;
	const { resourceId, userId } = req.body;
	let toDelete;
	try {
		toDelete = await db.query(
			'SELECT r.author, r.r_id, r.commentthread FROM resources r WHERE r.r_id = $1',
			[resourceId],
		);
		console.log(toDelete.rows[0]);
		if (!toDelete.rows.length) {
			return res.status(404).json({
				status: 'error',
				message: 'Failed to find resource with provided Id',
			});
		} else if (
			toDelete.rows[0].author !== senderId ||
			userId !== senderId
		) {
			errorLogger.error('Failed to delete resource');
			return res.status(403).json({ status: 'Unauthorized' });
		}
		toDelete = toDelete.rows[0];
	} catch (e) {
		errorLogger.error('Failed to get resource to be deleted: ' + e);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to get resource to be deleted',
		});
	}
	const client = await db.connect();

	try {
		await client.query('BEGIN');
		await client.query('DELETE FROM tagconnections t WHERE t.r_id = $1', [
			resourceId,
		]);
		await client.query('DELETE FROM voteconnections t WHERE t.r_id = $1', [
			resourceId,
		]);

		await client.query('DELETE FROM resources WHERE r_id = $1', [
			resourceId,
		]);
		await client.query('DELETE FROM commentthreads WHERE t_id = $1', [
			toDelete.commentthread,
		]);
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		errorLogger.error('Failed to delete resource: ' + e);
		return res.status(500).json({
			success: false,
			status: 'error',
			message: 'Failed to delete resource.',
		});
	} finally {
		client.release();
	}
	res.json({ success: true });
};

const searchTags = async (req, res) => {
	const query = req.query.q;
	let limit = req.query.limit;
	let tags;
	try {
		tags = await db.query(
			'SELECT * FROM tags WHERE title LIKE $1 ORDER BY title ASC LIMIT $2',
			[query + '%', limit],
		);
		tags = tags.rows;
	} catch (e) {
		errorLogger.error('Failed to find tags: ' + e);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to find tags',
		});
	}
	res.json(tags);
};

const updateResource = async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(422).json({
			status: 'error',
			message: 'Invalid input please try again.',
		});
	}
	let { resource } = req.body;

	let updatedResource;
	try {
		updatedResource = await db.query(
			`
        UPDATE resources SET 
        description = $1, 
        link = $2, 
        title = $3 
        WHERE r_id = $4`,
			[
				resource.description,
				resource.link,
				resource.title,
				resource.r_id,
			],
		);
		updatedResource = updatedResource.rows;
	} catch (e) {
		errorLogger.error('Failed to update resource: ' + e);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to update resource',
		});
	}
	res.json({ success: true });
};

const voteResource = async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(422).json({
			status: 'error',
			message: 'Invalid input please try again.',
		});
	}
	let { vote, resourceId } = req.body;
	const userId = req.decoded.u_id;
	let voteTarget;
	try {
		voteTarget = await db.query(
			`SELECT c.vote, c.u_id FROM voteconnections c WHERE c.r_id = $1 AND c.u_id =$2`,
			[resourceId, userId],
		);
		voteTarget = voteTarget.rows[0];
	} catch (e) {
		errorLogger.error('Failed to find target resource for voting: ' + e);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to find target resource for voting',
		});
	}
	const client = await db.connect();

	try {
		await client.query('BEGIN');
		if (!!voteTarget) {
			switch (vote) {
				case 0:
					vote = -voteTarget.vote;
					await client.query(
						`DELETE FROM voteconnections 
                            WHERE r_id = $1 AND u_id = $2`,
						[resourceId, userId],
					);
					break;
				case 1:
					vote = 2;
					await client.query(
						`UPDATE voteconnections 
                            SET vote = 1 
                            WHERE r_id = $1 AND u_id = $2`,
						[resourceId, userId],
					);
					break;
				case -1:
					vote = -2;
					await client.query(
						`UPDATE voteconnections 
                            SET vote = -1 
                            WHERE r_id = $1 AND u_id = $2`,
						[resourceId, userId],
					);
					break;
				default:
					errorLogger.error(
						'Failed to vote resource: Invalid vote input',
					);
					return res.status(500).json({
						success: false,
						status: 'error',
						message: 'Failed to vote resource.',
					});
			}
		} else {
			await client.query(
				`INSERT INTO 
                    voteconnections (r_id, u_id, vote) 
                   	VALUES ($1, $2, $3)`,
				[resourceId, userId, vote],
			);
		}
		await client.query(
			'UPDATE resources SET votes = votes + $1 WHERE r_id = $2',
			[vote, resourceId],
		);
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		errorLogger.error('Failed to vote resource: ' + e);
		return res.status(500).json({
			success: false,
			status: 'error',
			message: 'Failed to vote resource.',
		});
	} finally {
		client.release();
	}
	res.json({ success: true });
};

exports.getResources = getResources;

exports.getResourceById = getResourceById;

exports.addResource = addResource;

exports.deleteResource = deleteResource;

exports.deleteTagFromResource = deleteTagFromResource;

exports.addTagToResource = addTagToResource;

exports.searchTags = searchTags;

exports.updateResource = updateResource;

exports.voteResource = voteResource;
