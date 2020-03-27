const { validationResult } = require('express-validator');

const db = require('../postgres/queries');
const { errorLogger, accessLogger } = require('../logger');
const urlMetadata = require('url-metadata');
var URL = require('url').URL;

const getResources = async (req, res) => {
	const userId = req.decoded.u_id;

	const page = req.query.page || 1;
	const filter = req.query.filter || 'none';
	const order = req.query.order || 'popular';
	const reverse = req.query.reverse || 'false';

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
	try {
		if (filter === 'none') {
			resources = await db.query(
				`SELECT vc.vote, u.username, u.profile_pic, u.u_id,
                COALESCE(rv.votes, 0) AS votes, r.title, r.r_id, r.link, r.published_date, r.edited, r.thumbnail, r.resource_type,
                c.tags, c.colors FROM resources r
                JOIN users u ON r.author = u.u_id
                LEFT JOIN (
                SELECT c.r_id, array_agg(t.title) AS tags, array_agg(t.color) AS colors
                FROM tagconnections c
                JOIN tags t ON t.tag_id = c.tag_id
                GROUP BY c.r_id) c using (r_id) 
                LEFT JOIN (SELECT r_id, SUM(vote) AS votes FROM resourcevotes GROUP BY r_id) rv
                ON rv.r_id = r.r_id
                LEFT JOIN resourcevotes vc ON vc.r_id = r.r_id AND vc.u_id = $1 
                ORDER BY ${order1}, ${order2} LIMIT $2 OFFSET $3`,
				[userId, perPage, (page - 1) * perPage],
			);
		} else {
			resources = await db.query(
				`SELECT vc.vote, u.username, u.profile_pic, u.u_id, 
                COALESCE(rv.votes, 0) AS votes, r.title, r.r_id, r.link, r.published_date, r.edited,  r.thumbnail, r.resource_type,
                c.tags, c.colors FROM resources r 
                JOIN users u ON r.author = u.u_id 
                JOIN (
                SELECT c.r_id, array_agg(t.title) AS tags, array_agg(t.color) AS colors 
                FROM tagconnections c 
                JOIN tags t ON t.tag_id = c.tag_id 
                GROUP BY c.r_id) c using (r_id) 
                LEFT JOIN resourcevotes vc ON vc.r_id = r.r_id 
                LEFT JOIN (SELECT r_id, SUM(vote) AS votes FROM resourcevotes GROUP BY r_id) rv
                ON rv.r_id = r.r_id
                AND vc.u_id = $2 WHERE $1 = ANY (tags) 
                ORDER BY ${order1}, ${order2} LIMIT $3 OFFSET $4`,
				[filter, userId, perPage, (page - 1) * perPage],
			);
		}

		resources = resources.rows.map((r) => {
			return { ...r, owner: Number(r.u_id) === Number(userId) };
		});
	} catch (e) {
		errorLogger.error('Failed to get resources: ' + e);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to get resources',
		});
	}
	res.json(resources);
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
			`SELECT r.r_id, r.title, r.link, r.description, 
            r.author, r.votes, r.published_date, r.commentthread, r.thumbnail, 
            u.profile_pic, u.u_id, u.username 
            FROM resources r JOIN users u ON u.u_id = r.author 
            WHERE r.r_id = $1`,
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

const createResource = async (req, res) => {
	const client = await db.connect();
	const { title, description, link, type } = req.body;
	const userId = req.decoded.u_id;
	let md;
	try {
		md = await urlMetadata(link);
		console.log(md);
	} catch (e) {
		md = '';
	}
	let mdImage = md['og:image'];
	// if og:image is a relative path we try to create a valid url for it

	if (mdImage) {
		try {
			new URL(mdImage);
		} catch (e) {
			let newLink = new URL(link); // create a URL object from the provided link
			mdImage = newLink.origin + mdImage; // take origin + path to image should give us a usable url, in most cases
			try {
				new URL(mdImage);
			} catch (e) {
				mdImage = null;
			}
		}
	} else {
		mdImage = null;
	}
	let createdResource;
	try {
		await client.query('BEGIN');
		let t_id = await client.query(
			'INSERT INTO commentthreads DEFAULT VALUES RETURNING t_id',
		);
		t_id = t_id.rows[0].t_id;
		createdResource = await client.query(
			`WITH inserted as (
				INSERT INTO resources (title, thumbnail, description, link, commentthread, author, resource_type)
				VALUES ($1, $2, $3, $4, $5, $6, $7)
				RETURNING *) 
				SELECT i.r_id, i.title, i.thumbnail, i.resource_type,
				i.link, i.author, i.votes, i.published_date, i.commentthread, 
				u.profile_pic, u.username, u.u_id 
				FROM inserted i JOIN users u ON u.u_id = i.author WHERE u.u_id = $6`,
			[title, mdImage, description, link, t_id, userId, type],
		);
		createdResource = { ...createdResource.rows[0], tags: [] };
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		errorLogger.error('Failed to add Resource to DB: ' + e + e.code);
		if (e.code === '23505') {
			res.status(400).json({
				success: false,
				status: 'error',
				message: 'Title already exists',
			});
		} else {
			return res.status(500).json({
				success: false,
				status: 'error',
				message: 'Failed to add Resource to DB.',
			});
		}
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
		await client.query('DELETE FROM resourcevotes t WHERE t.r_id = $1', [
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
        title = $3,
        edited = NOW() 
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
			`SELECT c.vote, c.u_id FROM resourcevotes c WHERE c.r_id = $1 AND c.u_id =$2`,
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
						`DELETE FROM resourcevotes 
                            WHERE r_id = $1 AND u_id = $2`,
						[resourceId, userId],
					);
					break;
				case 1:
					vote = 2;
					await client.query(
						`UPDATE resourcevotes 
                            SET vote = 1 
                            WHERE r_id = $1 AND u_id = $2`,
						[resourceId, userId],
					);
					break;
				case -1:
					vote = -2;
					await client.query(
						`UPDATE resourcevotes 
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
                    resourcevotes (r_id, u_id, vote) 
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

exports.createResource = createResource;

exports.deleteResource = deleteResource;

exports.deleteTagFromResource = deleteTagFromResource;

exports.addTagToResource = addTagToResource;

exports.searchTags = searchTags;

exports.updateResource = updateResource;

exports.voteResource = voteResource;
