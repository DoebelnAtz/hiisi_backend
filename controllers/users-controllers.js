const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');

const db = require('../queries');

const getUsers = async (req, res, next) => {
    let users;
    try {
        const { rows } = await db.query('SELECT * FROM users');
        users = rows;
    } catch (e) {
        return console.log('ERROR: ' + e);
    }
    console.log(users);
    res.json({users: users.map(user => user)});
};

const getUserById = async (req, res, next) => {
    const userId = req.params.pid;
    let user;
    try {
        const {rows} = await db.query('SELECT id, username FROM users WHERE id = $1', [userId]);
        user = rows[0];
    } catch (e) {
        return console.log('ERROR: ' + e);
    }
    console.log(user);
    res.json({user: user});
};

// const signUp = async (req, res, next) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//         return next(new HttpError('Invalid credentials' + errors, 400));
//     }
//     const {username, password, intraId} = req.body;
//
//     let existingUser;
//     try {
//         existingUser = await User.findOne({username: username})
//     } catch (e) {
//         return next(new HttpError('Signup failed, please try again later (error: 1)'), 500);
//     }
//
//     if (existingUser) {
//         return next(new HttpError('User already exists, please login instead', 400));
//     }
//
//     let hashedPassword;
//     try {
//         hashedPassword = await bcrypt.hash(password, 10);
//     } catch (e) {
//         return next(
//             new HttpError('Cannot create user', 500)
//         );
//     }
//
//     const createdUser = new User({
//         username,
//         password: hashedPassword,
//         intraId,
//         blogPosts: []
//     });
//
//     try {
//         await createdUser.save();
//     } catch (e) {
//         console.log(e);
//         return next(new HttpError('Signup failed, please try again later (error: 2)', 500));
//     }
//     res.status(201).json({user: createdUser.toObject({getters: true})});
// };
//
// const login = async (req, res, next) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//         return next(new HttpError('login failed, try again', 500));
//     }
//
//     const { username, password } = req.body;
//
//     let existingUser;
//     try {
//         existingUser = await User.findOne({ username: username })
//     } catch (e) {
//         return next(new HttpError('login failed, please try again', 500))
//     }
//
//     let isValidPass = false;
//     try {
//         isValidPass = await bcrypt.compare(password, existingUser.password)
//     } catch (e) {
//         return next(
//             new HttpError('login failed, please try again', 500)
//         );
//     }
//
//     if (!existingUser || !isValidPass) {
//         return next(new HttpError('Invalid credentials, please try again', 401));
//     }
//
//     res.json({ message: 'logged in!' })
// };

exports.getUsers = getUsers;
exports.getUserById = getUserById;
// exports.signUp = signUp;
// exports.login = login;