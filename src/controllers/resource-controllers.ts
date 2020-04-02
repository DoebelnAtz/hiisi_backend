import { catchErrors } from '../errors/catchErrors';
import CustomError from '../errors/customError';
import { errorLogger } from '../logger';

const db = require('../postgres/queries');
const urlMetadata = require('url-metadata');
var URL = require('url').URL;

export const getResources = catchErrors(async (req, res) => {
	const userId = req.decoded.u_id;

	const page = req.query.page || 1;
	const filter = req.query.filter || 'none';
	const show = req.query.show || 'all';
	const order = req.query.order || 'popular';
	const reverse = req.query.reverse || 'false';

	// we are dangerously inserting values into a query so we need to make sure that
	// the order parameter is correct
	if (order !== 'popular' && order !== 'recent' && order !== 'title') {
		throw new CustomError('Invalid query parameters', 422);
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
	// Messy query... to summarize:
	// if user wants saved resources we use JOIN else LEFT JOIN,
	// if user is filtering tags we add a AND clause to the last JOIN
	resources = await db.query(
		`SELECT vc.vote, u.username, u.profile_pic, u.u_id, u.u_id, sr.u_id IS NOT NULL AS saved,
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
			ORDER BY ${order1}, ${order2} LIMIT $2 OFFSET $3`,

		filter === 'none'
			? [userId, perPage, (page - 1) * perPage]
			: [userId, perPage, (page - 1) * perPage, filter],
	);
	resources = resources.rows.map((r: any) => {
		return { ...r, owner: Number(r.u_id) === Number(userId) };
	});
	res.json(resources);
}, 'Failed to get resources');

export const saveResource = catchErrors(async (req, res) => {
	const { rId } = req.body;
	const senderId = req.decoded.u_id;
	const client = await db.connect();

	try {
		await client.query('BEGIN');
		await client.query(
			`INSERT INTO saved_resources (r_id, u_id)
			VALUES ($1, $2)`,
			[rId, senderId],
		);
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		errorLogger.error('Failed to save resource: ' + e);
		return res.status(500).json({
			success: false,
			status: 'error',
			message: 'Failed to save resource.',
		});
	} finally {
		client.release();
	}
	res.json({ success: true });
}, 'Failed to save resource');

export const unSaveResource = catchErrors(async (req, res) => {
	const { rId } = req.body;
	const senderId = req.decoded.u_id;
	const client = await db.connect();

	try {
		await client.query('BEGIN');
		await client.query(
			`DELETE FROM saved_resources WHERE r_id = $1 AND u_id = $2`,
			[rId, senderId],
		);
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		errorLogger.error('Failed to un-save resource: ' + e);
		throw Error;
		// return res.status(500).json({
		// 	success: false,
		// 	status: 'error',
		// 	message: 'Failed to un-save resource.',
		// });
	} finally {
		client.release();
	}
	res.json({ success: true });
}, 'Failed to un-save resource');

export const deleteTagFromResource = catchErrors(async (req, res) => {
	const { tagId, rId } = req.body;
	await db.query(
		`DELETE from tagconnections WHERE tag_id = $1 
		AND r_id = $2`,
		[tagId, rId],
	);
	res.json({ success: true });
}, 'Failed to delete tag from resource');

export const addTagToResource = catchErrors(async (req, res) => {
	const { tag, rId } = req.body;

	const client = await db.connect();
	try {
		await client.query('BEGIN');

		await client.query(
			'INSERT INTO tagconnections (tag_id, r_id) ' +
				'VALUES ($1, $2) RETURNING tag_id, r_id',
			[tag.tag_id, rId],
		);
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
}, 'Failed to add tag');

export const getResourceById = catchErrors(async (req, res) => {
	const resourceId = req.params.rid;
	const senderId = req.decoded.u_id;

	let resource = await db.query(
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

	let tags = await db.query(
		'SELECT t.title, t.tag_id, t.color FROM ' +
			'tags t JOIN tagconnections c ' +
			'ON t.tag_id = c.tag_id WHERE c.r_id = $1',
		[resourceId],
	);
	tags = tags.rows;
	resource = { ...resource, tags: tags };
	res.json(resource);
}, 'Failed to get tags for resource');

export const createResource = catchErrors(async (req, res) => {
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
				message: 'Failed to create resource.',
			});
		}
	} finally {
		client.release();
	}
	res.status(201).json(createdResource);
}, 'Failed to create resource');

export const deleteResource = catchErrors(async (req, res) => {
	const senderId = req.decoded.u_id;
	const { resourceId, userId } = req.body;
	let toDelete;

	toDelete = await db.query(
		'SELECT r.author, r.r_id, r.commentthread FROM resources r WHERE r.r_id = $1',
		[resourceId],
	);
	if (!toDelete.rows.length) {
		throw new CustomError('Failed to find resource with provided id', 404);
	} else if (toDelete.rows[0].author !== senderId || userId !== senderId) {
		throw new CustomError('Unauthorized resource deletion', 401);
	}
	toDelete = toDelete.rows[0];

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
}, 'Failed to delete resource');

export const searchTags = catchErrors(async (req, res) => {
	const query = req.query.q;
	let limit = req.query.limit;
	let tags;
	tags = await db.query(
		'SELECT * FROM tags WHERE title LIKE $1 ORDER BY title ASC LIMIT $2',
		[query + '%', limit],
	);
	tags = tags.rows;

	res.json(tags);
}, 'Failed to find tags');

export const updateResource = catchErrors(async (req, res) => {
	let { resource } = req.body;

	await db.query(
		`
	UPDATE resources SET 
	description = $1, 
	link = $2, 
	title = $3,
	edited = NOW() 
	WHERE r_id = $4`,
		[resource.description, resource.link, resource.title, resource.r_id],
	);
	res.json({ success: true });
}, 'Failed to update resource');

export const voteResource = catchErrors(async (req, res) => {
	let { vote, resourceId } = req.body;
	const userId = req.decoded.u_id;
	let voteTarget = await db.query(
		`SELECT c.vote, c.u_id FROM resourcevotes c WHERE c.r_id = $1`,
		[resourceId, userId],
	);

	voteTarget = voteTarget.rows[0];
	if (voteTarget.rows.length !== 1) {
		throw new CustomError('Failed to find vote target', 404);
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
}, 'Failed to vote resource');
