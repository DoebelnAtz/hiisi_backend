const db = require('../queries');
const { errorLogger, accessLogger } = require('../logger');

const getResources = async (req, res) => {

    const userId = req.decoded.u_id;

    const pagination = req.query.page;

    let resources;
    try {
        resources = await db.query(
            'SELECT r.r_id, ' +
            'r.description, r.title, r.link, r.votes, r.published_date, ' +
            'u.profile_pic, u.u_id, u.username ' +
            'FROM resources r JOIN users u ON u.u_id = r.author ' +
            'WHERE 1 = 1 LIMIT $1' , [20 * Number(pagination)]);
        resources = resources.rows.map(r => {return ({...r, owner: Number(r.u_id) === Number(userId)}) })
    } catch(e) {
        errorLogger.error('Failed to get resources: ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get resources'
        })
    }
    let tags;
    try {
        for (var i = 0; i < resources.length; i++) {
            tags = await db.query(
                'SELECT t.title, t.tag_id, t.color FROM tags t ' +
                'JOIN tagconnections c ON c.tag_id = t.tag_id ' +
                'WHERE c.r_id = $1', [resources[i].r_id]);
            tags = tags.rows;
            resources[i] = {...resources[i], tags};
        }
    } catch(e) {
        errorLogger.error('Failed to get tags for resource: ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get tags for resource'
        })
    }
    res.json(resources);
};

const addTagToResource = async (req, res) => {
    const { tag, rId } = req.body;


    const client = await db.connect();
    let createdTag;
    try{
        await client.query('BEGIN');

        let created = await client.query(
            'INSERT INTO tagconnections (tag_id, r_id) ' +
            'VALUES ($1, $2) RETURNING tag_id, r_id',
            [tag.tag_id, rId]
        );
            createdTag = created.rows[0];
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        errorLogger.error('Failed to add tags: ' + e);
        return res.status(500).json({
            success: false,
            status: 'error',
            message: 'Failed to add tags.'
        })
    } finally {
        client.release();
    }
    res.json(tag)
};

const getResourceById = async (req, res) => {

    const resourceId = req.params.rid;

    let resource;
    try {
        resource = await db.query(
            'SELECT r.r_id, r.title, r.link, r.description, r.author, r.votes, r.published_date, r.commentthread, ' +
            'u.profile_pic, u.u_id, u.username ' +
            'FROM resources r JOIN users u ON u.u_id = r.author ' +
            'WHERE r.r_id = $1' , [resourceId]);
        resource = resource.rows[0];
    } catch(e) {
        errorLogger.error('Failed to get resource: ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get resource'
        })
    }

    let tags;
    try {
        tags = await db.query(
            'SELECT t.title, t.tag_id, t.color FROM ' +
            'tags t JOIN tagconnections c ' +
            'ON t.tag_id = c.tag_id WHERE c.r_id = $1', [resourceId]);
        tags = tags.rows;
        resource = {...resource, tags: tags}
    } catch(e) {
        errorLogger.error('Failed to get tags for resource: ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get tags for resource'
        })
    }
    res.json(resource);
};

const addResource = async (req, res) => {
    const client = await db.connect();
    const {title, description, link} = req.body;
    const userId = req.decoded.u_id;
    let createdResource;
    try{
        await client.query('BEGIN');
        let t_id = await client.query(
            'INSERT INTO commentthreads DEFAULT VALUES RETURNING t_id');
        t_id = t_id.rows[0].t_id;
        createdResource = await client.query(
            'WITH inserted as ('+
            'INSERT INTO resources (title, description, link, commentthread, author) ' +
            'VALUES ($1, $2, $3, $4, $5)' +
            'RETURNING *) ' +
            'SELECT i.r_id, i.title, ' +
            'i.link, i.author, i.votes, i.published_date, i.commentthread, ' +
            'u.profile_pic, u.username, u.u_id ' +
            'FROM inserted i JOIN users u ON u.u_id = i.author WHERE u.u_id = $5',
            [title, description, link, t_id, userId]);
        createdResource = {...createdResource.rows[0], tags: []};
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        errorLogger.error('Failed to add Resource to DB: ' + e);
        return res.status(500).json({
            success: false,
            status: 'error',
            message: 'Failed to add Resource to DB.'
        })
    } finally {
        client.release();
    }
    res.status(201).json(createdResource);
};

const deleteResource = async (req,res) => {
    
    const senderId = req.decoded.u_id;
    const { resourceId, userId } = req.body;
    let toDelete;
    try {
        toDelete = await db.query(
            'SELECT r.author, r.r_id, r.commentthread FROM resources r WHERE r.r_id = $1',
            [resourceId]);
        console.log(toDelete.rows[0]);
        if (!toDelete.rows.length
            ) {
            return res.status(404).json({
                    status: 'error',
                    message: 'Failed to find resource with provided Id'
            })
        } else if (toDelete.rows[0].author !== senderId || userId !== senderId) {
            errorLogger.error('Failed to delete resource');
            return res.status(403).json({status: 'Unauthorized'})
        }
        toDelete = toDelete.rows[0];
    } catch(e) {
        errorLogger.error('Failed to get resource to be deleted: ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get resource to be deleted'
        })
    }
    const client = await db.connect();
    
        try{
            await client.query('BEGIN');
            await client.query('DELETE FROM tagconnections t WHERE t.r_id = $1', [resourceId]);
            await client.query(
                'DELETE FROM resources WHERE r_id = $1',
                [resourceId]
            );
            await client.query(
                'DELETE FROM commentthreads WHERE t_id = $1',
                [toDelete.commentthread]
            );
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            errorLogger.error('Failed to delete resource: ' + e);
            return res.status(500).json({
                success: false,
                status: 'error',
                message: 'Failed to delete resource.'
            })
        } finally {
            client.release();
        }
    res.json({success: true})
};

const searchTags = async (req, res) => {
  const query = req.query.q;

  let tags;
  try {
      tags = await db.query('SELECT * FROM tags WHERE title LIKE $1 LIMIT 10', [query + '%']);
      tags = tags.rows;
  } catch(e) {
      errorLogger.error('Failed to find tags: ' + e);
      return res.status(500).json({
          status: 'error',
          message: 'Failed to find tags'
      })
  }
  res.json(tags);
};

exports.getResources = getResources;

exports.getResourceById = getResourceById;

exports.addResource = addResource;

exports.deleteResource = deleteResource;

exports.addTagToResource = addTagToResource;

exports.searchTags = searchTags;