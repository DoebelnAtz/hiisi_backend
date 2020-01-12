const express = require('express');
const bodyParser = require('body-parser');

const userRoutes = require('./routes/user-routes');
//const blogRoutes = require('./routes/blog-routes');
const db = require('./queries');

const app = express();

app.use(bodyParser.json());
app.use('/api/users', userRoutes);
//app.use('/api/blogs', blogRoutes);

app.listen(5000);

