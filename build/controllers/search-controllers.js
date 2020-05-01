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
const queries_1 = __importDefault(require("../postgres/queries"));
const searchAll = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const q = req.query.q;
    let result = yield queries_1.default.query(`SELECT * FROM (
		SELECT u.username AS title, u.u_id AS id, 'user' AS type, '/user' AS link
		FROM users u
		UNION ALL 
		SELECT r.title, r.r_id AS id, 'resource' AS type, '/resources' AS link 
		FROM resources r 
		UNION ALL 
		SELECT b.title, b.b_id AS id, 'post' AS type, '/forum' AS link 
		FROM blogs b 
		UNION ALL 
		SELECT p.title, p.project_id AS id, 'project' AS type, '/projects' AS link 
		FROM projects p WHERE p.private = FALSE ORDER BY title ASC
		) AS res WHERE LOWER(res.title) LIKE LOWER($1) LIMIT 10`, [q + '%']);
    result = result.rows;
    if (result.length < 10) {
        let matched = yield queries_1.default.query(`SELECT * FROM (
		SELECT u.username AS title, u.u_id AS id, 'user' AS type, '/user' AS link
		FROM users u
		UNION ALL 
		SELECT r.title, r.r_id AS id, 'resource' AS type, '/resources' AS link 
		FROM resources r 
		UNION ALL 
		SELECT b.title, b.b_id AS id, 'post' AS type, '/forum' AS link 
		FROM blogs b 
		UNION ALL 
		SELECT p.title, p.project_id AS id, 'project' AS type, '/projects' AS link 
		FROM projects p WHERE p.private = FALSE ORDER BY title ASC
		) AS res WHERE LOWER(res.title) LIKE LOWER($1) LIMIT $2`, ['%' + q + '%', 10 - result.length]);
        result = [
            ...result,
            ...matched.rows.filter((match) => !result.find((res) => res.title === match.title)),
        ];
    }
    res.json(result);
}), 'Failed to search database');
module.exports = {
    searchAll,
};
//# sourceMappingURL=search-controllers.js.map