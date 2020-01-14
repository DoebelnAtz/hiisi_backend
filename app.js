const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
let jwt = require('jsonwebtoken');
const config = require('./config.js');
let middleware = require('./middleware');

const schedule = require('node-schedule');

const authRoutes = require('./routes/auth-routes');
const userRoutes = require('./routes/user-routes');
const blogRoutes = require('./routes/blog-routes');
const userJobs = require('./scheduled-jobs/update-users');
const messageRoutes = require('./routes/message-routes');

const app = express();
var j = schedule.scheduleJob('*/10 * * * * ', userJobs.update); // execute job every X minutes, cron-like syntax

app.use(cors());
app.use(bodyParser.json());
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/', middleware.checkToken);

app.use('/api/users', userRoutes);
app.use('/api/blogs', blogRoutes);

app.listen(5000);

