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
const queries_1 = __importDefault(require("../postgres/queries"));
exports.getMe = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.decoded.u_id;
    let user = yield queries_1.default.query(`SELECT
            u_id,
            username,
            intraid, 
            profile_pic, 
            coalition_points, 
            coalition_rank,
            grade, 
            level, 
            class_of, 
            wallet, 
            location, 
            active, 
            correction_points, 
            achievement_points 
            FROM users WHERE u_id = $1`, [userId]);
    user = user.rows[0];
    if (!user) {
        throw new customError_1.default('Failed to find user matching the provided token', 404);
    }
    res.json(user);
}), 'Failed to get current user');
exports.getUserFriends = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { uid } = req.params;
    let friends = yield queries_1.default.query('SELECT u_id, username, profile_pic ' +
        'FROM users JOIN friends ON users.u_id = friends.two_id WHERE friends.one_id = $1', [uid]);
    friends = friends.rows;
    res.json(friends);
}), 'Failed to get friends');
exports.getUsers = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let users = yield queries_1.default.query(`SELECT
            u_id, 
            username, 
            profile_pic, 
            coalition_points, 
            coalition_rank, 
            grade, 
            level, 
            class_of, 
            wallet, 
            location, 
            active, 
            correction_points, 
            achievement_points 
            FROM users`);
    users = users.rows;
    res.json(users);
}), 'Failed to get users');
exports.getUserById = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.params.pid;
    let user = yield queries_1.default.query(`SELECT 
            u_id, 
            username, 
            intraid, 
            profile_pic, 
            coalition_points, 
            coalition_rank, 
            grade, 
            level, 
            class_of, 
            wallet,
            location, 
            active, 
            correction_points, 
            achievement_points 
            FROM users WHERE u_id = $1`, [userId]);
    user = user.rows[0];
    if (!user) {
        throw new customError_1.default('Failed to find user with the provided user id', 404);
    }
    res.json(user);
}), 'Failed to get user');
exports.getOnlineUsers = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let users = yield queries_1.default.query(`SELECT u_id, last_updated FROM online_users WHERE last_updated > NOW() - interval '5 minutes'`);
    users = users.rows;
    res.json(users);
}), 'Failed to get online users');
exports.searchUsers = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const search = req.query.q;
    let usersFound = yield queries_1.default.query(`SELECT u_id, username, intraid, profile_pic 
            FROM users WHERE username LIKE $1`, [search + '%']);
    usersFound = usersFound.rows;
    res.json(usersFound);
}), 'Failed to search for users');
exports.getAllByUserId = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = req.query.page || 1;
    const senderId = req.decoded.u_id;
    const userId = req.query.user || senderId;
    const filter = req.query.filter || 'none';
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
            order1 = `res.votes ${reverseOrder}`;
            order2 = 'res.published_date DESC';
            break;
        case 'recent':
            reverseOrder = reverse === 'true' ? 'ASC' : 'DESC';
            order1 = `res.published_date ${reverseOrder}`;
            order2 = 'res.votes DESC';
            break;
        default:
            reverseOrder = reverse === 'true' ? 'DESC' : 'ASC';
            order1 = `res.title ${reverseOrder}`;
            order2 = 'res.published_date DESC';
    }
    let userSubmissions;
    switch (filter) {
        default:
            userSubmissions = yield queries_1.default.query(`SELECT * FROM (
			SELECT p.title, null AS thumbnail, COALESCE(pvotes.votes, 0) AS votes, pv.vote, p.published_date,
			p.project_id as id, 'project' AS type, '/projects' AS link
			FROM projects p 
			LEFT JOIN projectvotes pv 
			ON pv.project_id = p.project_id AND pv.u_id = $2
			LEFT JOIN (SELECT project_id, SUM(vote) AS votes FROM projectvotes
				GROUP BY project_id) pvotes
				ON pvotes.project_id = p.project_id
			WHERE p.creator = $1 AND p.private = false
			UNION ALL 
			SELECT r.title, r.thumbnail,  COALESCE(rvotes.votes, 0) AS votes, rv.vote, r.published_date,
			r.r_id AS id, 'resource' AS type, '/resources' AS link 
			FROM resources r 
			LEFT JOIN 
			(SELECT r_id, SUM(vote) AS votes FROM resourcevotes GROUP BY r_id) rvotes
			ON rvotes.r_id = r.r_id
			LEFT JOIN resourcevotes rv ON r.r_id = rv.r_id AND rv.u_id = $2 
			WHERE r.author = $1
			UNION ALL 
			SELECT b.title,  null AS thumbnail, COALESCE(bvotes.votes, 0) AS votes, bv.vote, b.published_date,
			b.b_id AS id, 'post' AS type, '/forum' AS link 
			FROM blogs b 
			LEFT JOIN (SELECT b_id, SUM(vote) AS votes FROM blogvotes GROUP BY b_id) bvotes
			ON bvotes.b_id = b.b_id
			LEFT JOIN blogvotes bv ON bv.b_id = b.b_id AND bv.u_id = $2
			WHERE b.author =$1
			) AS res ORDER BY ${order1}, ${order2} LIMIT $3 OFFSET $4`, [userId, senderId, 14, (page - 1) * 14]);
            break;
        case 'posts':
            userSubmissions = yield queries_1.default.query(`
			SELECT * FROM (
			SELECT b.title, COALESCE(bvotes.votes, 0) AS votes, v.vote, b.published_Date, 'post' AS type, '/posts' AS link, b.b_id AS id
			FROM blogs b 
			LEFT JOIN (SELECT b_id, SUM(vote) AS votes FROM blogvotes GROUP BY b_id) bvotes
			ON bvotes.b_id = b.b_id
			LEFT JOIN blogvotes v ON b.b_id = v.b_id 
			AND v.u_id = $2 WHERE b.author = $1
			) AS res ORDER BY ${order1}, ${order2} LIMIT $3 OFFSET $4`, [userId, senderId, 14, (page - 1) * 14]);
            break;
        case 'resources':
            userSubmissions = yield queries_1.default.query(`
			SELECT * FROM (
			SELECT r.title, COALESCE(rvotes.votes, 0) AS votes, v.vote, r.published_Date, r.thumbnail, 'resource' AS type, '/resources' AS link, r.r_id AS id 
			FROM resources r 
			LEFT JOIN 
			(SELECT r_id, SUM(vote) AS votes FROM resourcevotes GROUP BY r_id) rvotes
			ON rvotes.r_id = r.r_id
			LEFT JOIN resourcevotes v ON r.r_id = v.r_id AND v.u_id = $2 WHERE r.author = $1
			) AS res ORDER BY ${order1}, ${order2} LIMIT $3 OFFSET $4`, [userId, senderId, 14, (page - 1) * 14]);
            break;
        case 'projects':
            userSubmissions = yield queries_1.default.query(`
			SELECT * FROM (
			SELECT p.title, COALESCE(pvotes.votes, 0) AS votes, v.vote, p.published_Date, 'project' AS type, '/projects' AS link, p.project_id AS id
			FROM projects p 
			LEFT JOIN (SELECT project_id, SUM(vote) AS votes FROM projectvotes
				GROUP BY project_id) pvotes
				ON pvotes.project_id = p.project_id
			LEFT JOIN projectvotes v ON p.project_id = v.project_id AND v.u_id = $2 WHERE p.creator = $1 AND (p.private = false OR p.creator = $2)
			) AS res ORDER BY ${order1}, ${order2} LIMIT $3 OFFSET $4`, [userId, senderId, 14, (page - 1) * 14]);
            break;
    }
    return res.json(userSubmissions.rows);
}), 'Failed to get user submissions');
//# sourceMappingURL=users-controllers.js.map