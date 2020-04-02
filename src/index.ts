import { NextFunction } from 'express';
import SocketIO from 'socket.io';
import { handleError } from './middleware/handleError';

const express = require('express');
const cors = require('cors');
let middleware = require('middleware');
const app = express();
require('dotenv').config();

const schedule = require('node-schedule');
const authRoutes = require('./routes/auth-routes');
const userRoutes = require('./routes/user-routes');
const notificationRoutes = require('./routes/notification-routes');
const blogRoutes = require('./routes/blog-routes');
const userJobs = require('update-users');
const projectRotes = require('./routes/project-routes');
const messageRoutes = require('./routes/message-routes');
const resourceRoutes = require('./routes/resource-routes');
const chatController = require('./controllers/chat-controllers');
const searchRoutes = require('./routes/search-routes');

app.listen(process.env.PORT || 5000);
const io = require('socket.io')(process.env.SOCKET_PORT || 5010, {
	handlePreflightRequest: function(req: any, res: any) {
		var headers = {
			// socket cors headers
			'Access-Control-Allow-Headers': 'Content-Type, Authorization, Room',
			'Access-Control-Allow-Origin': req.headers.origin,
			'Access-Control-Allow-Credentials': true,
		};
		res.writeHead(200, headers);
		return res.end();
	},
});
io.origins('*:*'); // allow all request origins for sockets

schedule.scheduleJob('*/30 * * * * ', userJobs.update); // execute job every X minutes, cron-like syntax

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes); // auth routes before check token, because login requests do not supply a Token.
app.use('/api', middleware.checkToken);
app.use('/', middleware.logRequests); // log every incoming access request except auth routes, we don't want to log incoming passwords,
io.use((socket: SocketIO.Socket, next: NextFunction) =>
	middleware.checkSocketToken(socket, next),
); // make sure socket requests token is correct;
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/projects', projectRotes);
app.use('/api/messages', messageRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/search', searchRoutes);
app.use(handleError);

io.on('connection', (socket: any) => {
	console.log('connected!');
	socket.join(socket.request.headers.room, () => {
		// when connecting to socket, join the appropriate room
		console.log('Joined room: ' + socket.request.headers.room);
		io.to(socket.request.headers.referer).emit(
			'joined-room',
			socket.body.decoded,
		);
	});
	console.log(socket.body.decoded);

	socket.on('send-message', (message: any) => {
		chatController.saveMessageToDB(socket, message, io);
	});

	socket.on('disconnect', () => {
		console.log(
			'Disconnected from room: ' + socket.request.headers.referer,
		);
		io.to(socket.request.headers.referer).emit(
			'left-room',
			socket.body.decoded,
		);
	});
});
