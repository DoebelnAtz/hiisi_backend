

<h1>Endpoints</h1>

<h3>/api</h3>

<h4>/auth</h4>

/signup

    POST: signup

/login

    POST: login


<h4>/blog</h4>

/
    
    GET: get blogs

/:bid
    
    GET: get blog by id

/commentthread/:tid
    
    GET: get commentthread by id

/create_blog
    
    POST: create a blog

/create_comment

    POST: create a comment


/like_post

    POST: like a post
    
<h4>/projects</h4>

/boards/add_task

    POST: adds task to board
    
/boards/:bid

    GET: get boards by id

/boards/save_board

    POST: save board state (not in use)

/:pid

    GET: get project by id
    
/

    GET: get projects
    
/boards/update_task

    PUT: update task
    
<h4>/users</h4>

/

    GET: get all users
    
/me

    GET: get current user based on token
    
/:pid

    GET: get user by id
    
 /friends/:uid
 
    GET: get friends by user id
    
 /search
 
    POST: returns user based on given string
 
<h4>/messages</h4>

/threads

    GET: get all chat threads the requesting user is a part of
    
/threads/:tid

    GET: get thread by id
    
/threads/create_thread

    POST: create new thread
    
/threads/add_user

    POST: add user to thread
    
/threads/:tid/users

    GET: get all users part of thread

