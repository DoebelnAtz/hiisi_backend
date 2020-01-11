const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const userRoutes = require('./routes/user-routes');
const blogRoutes = require('./routes/blog-routes');

const app = express();

app.use(bodyParser.json());
app.use('/api/users', userRoutes);
app.use('/api/blogs', blogRoutes);


mongoose
    .connect('mongodb+srv://aadlercr:94502491Hive@cluster0-fyteo.mongodb.net/hivemind?retryWrites=true&w=majority')
    .then(() => {
        app.listen(5000);
    })
    .catch(err => {
        console.log(err);
    });
