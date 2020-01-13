const express = require('express');
const bodyParser = require('body-parser');

const userRoutes = require('./routes/user-routes');
const blogRoutes = require('./routes/blog-routes');
const db = require('./queries');
const schedule = require('node-schedule');

const userJobs = require('./scheduled-jobs/update-users');

const app = express();
var j = schedule.scheduleJob('*/2 * * * ', userJobs.update);
app.use(bodyParser.json());
app.use('/api/users', userRoutes);
app.use('/api/blogs', blogRoutes);

app.listen(5000);

