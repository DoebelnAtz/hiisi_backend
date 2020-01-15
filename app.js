const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
let middleware = require('./middleware');

const app = express();
const server = app.listen(5000);
const io = require('socket.io').listen(server);
io.origins('*:*');

const schedule = require('node-schedule');
const authRoutes = require('./routes/auth-routes');
const userRoutes = require('./routes/user-routes');
const blogRoutes = require('./routes/blog-routes');
const userJobs = require('./scheduled-jobs/update-users');
const messageRoutes = require('./routes/message-routes');


var j = schedule.scheduleJob('*/10 * * * * ', userJobs.update); // execute job every X minutes, cron-like syntax

app.use(cors());
app.use(bodyParser.json());
app.use('/api/auth', authRoutes);

app.use('/api', middleware.checkToken);
app.use('/', middleware.logRequests);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/blogs', blogRoutes);
var id = 555;

io.on('connection', socket => {
    console.log(io.sockets.clients());
    console.log("connected!");
    socket.join(socket.request.headers.referer, () => {
        console.log('joined')
    });

    socket.on('send-message', (message) => {
        console.log(socket.rooms);
        message.m_id = id++;
        console.log(message);
        io.to(socket.request.headers.referer).emit('chat-message', message)
    });
    socket.on('disconnect', () => {
        console.log('Disconnected!')
    })
});



