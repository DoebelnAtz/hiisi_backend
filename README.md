

<h1>Endpoints</h1>

<h3>/api</h3>

<h4>/auth</h4>

    POST: /signup

    signup
    
    required: username, intraId, password
    
    

    POST: /login

    login
    
    required: username, password


<h4>/blog</h4>

    GET: /
    
    get blogs
    
    

    GET: /:bid
    
    get blog by 
    
    

    GET: /commentthread/:tid
    
    get commentthread by id
    
    

    POST: /create_blog
    
    create a blog
    
    required: title, content
    
    

    POST: /create_comment

    create a comment
    
    required: threadId, content



    POST: /vote_blog

    vote on a post
    
    required: blogId, vote
    
    
    
    DELETE: /delete_blog
    
    delete a post
    
    required: blogId
    
<h4>/projects</h4>

    
    
    GET: /boards/:bid

    get boards by id
    
    
    
    GET: /:pid

    get project by id
    
    
    
    GET: /

    get projects
    
    
    
    POST: /boards/save_board

    save board state (not in use)
    
    
    
    POST: /boards/add_task

    adds task to board
    
    required: taskTitle, taskColumnId
    
    
    
    POST: /vote_project
    
    vote on a project
    
    required: projectId, vote
  
    
    
    POST: /boards/tasks/add_user
    
    adds user to task
    
    required: userId, taskId
    
    
    
    PUT: /boards/update_task

    update task
    
    required: updatedTask object with title, description, column_id and task_id fields
    
    
    PUT: /boards/update_column_title
    
    updates column title
    
    required: title, columnId
    
    
    
    PUT: /boards/update_task_position
    
    updates position of task in a board
    
    required: updatedTask object with column_id, task_id field
    
    
    
<h4>/users</h4>

    GET: /

    get all users
    
    
    
    GET: /me

    get current user based on token
    
    
    
    GET: /:pid

    get user by id
    
    
    
    GET: /friends/:uid
 
    get friends by user id
    
    
    
    POST: /search
 
    returns user based on given string
    
    required: search
 
<h4>/messages</h4>

    GET: /threads
    
    get all chat threads the requesting user is a part of
    
    
    
    GET: /threads/:tid
    
    get thread by id
    

    
    GET: /threads/:tid/users
    
    get all users part of thread
    


    POST: /threads/create_thread
    
    create new thread
    
    required: threadName
    
    
    
    POST: /threads/add_user
    
    add user to thread
    
    required: targetId, threadId
    
    
<h4>/resources</h4>


    GET: /
    
    get resources:
    
    required params: page, filted, order, reverse
    
    
    
    GET: /tags
    
    get tags
    
    required params: q: search string, limit: number of tags returned
    
    
    
    GET: /:rid
    
    get resource by id
    
    
    
    POST: /add_tags
    
    add tag to resource
    
    required: tag object with tag_id and rId fields
    
    
    
    POST: /vote_resource
    
    vote on a resource
    
    required: vote, resourceId
    
    
    POST /add_resource
    
    create a resource
    
    required: userId, taskId
    
    
    
    DELETE: /delete_resource
    
    deletes a resource
    
    required: userId, resourceId
    
    
    
    DELETE: /delete_tag
    
    deletes a tag from a resource
    
    required: tagId, rId
    
    
    
    PUT: /update_resource
    
    updates a resource
    
    required: resource object with description, link, title, and r_id fields
    
    
<h4>/search</h4>


    GET: /
    
    searches database for resources, users, posts and projects
    
    required params: q: search string
