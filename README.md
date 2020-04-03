
[auth](#auth)

[blog](#blog)

[projects](#projects)

[users](#users)

[messages](#messages)

[resources](#resources)

[search](#search)

<h1>Endpoints</h1>

<h1>/api/</h1>

# auth


    POST: /signup

    signup
    
    required: username (>7), password
    
    

    POST: /login

    login
    
    required: username, password



    PUT: /change_password
    
    change password
    
    required: username, currentPassword, newPassword
    
# blog

    GET: /
    
    get blogs
    
    required query params: 
         page (def: 1)
         order (def: popular)
         reverse (def: false)
    
    

    GET: /:bid
    
    get blog by id
    
    

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
    

    PUT: /update_blog
    
    update blog title, content
    
    required: content, title, blogId
    
    
    DELETE: /delete_blog
    
    delete a post
    
    required: blogId
    
    
    DELETE: /delete_comment
    
    delete a comment
    
    required: 
    
    
# projects

    
    
    GET: /boards/:bid

    get boards by id
    
    
    
    GET: /:pid

    get project by id
    
    
    
    GET: /

    get projects
    
    required query params: 
         page (def: 1)
         order (def: popular)
         reverse (def: false)
    
    
    POST: /boards/save_board

    save board state (not in use)
    
    
    
    POST: /create_project
    
    create a project
    
    required fields: title, description, link, private
    
    
    
    POST: /boards/add_task

    adds task to board
    
    required: taskTitle, taskColumnId
    
    
    
    POST: /vote_project
    
    vote on a project
    
    required: projectId, vote
  
    
    
    POST: /boards/tasks/add_user
    
    adds user to task
    
    required: userId, taskId
    
    
    
    PUT: /update_project

    updates title, description of project
    
    required: ProjectId, title, description    
    
    
    PUT: /boards/update_task

    update task
    
    required: title, description, column_id and task_id fields
    
    
    PUT: /boards/update_column_title
    
    updates column title
    
    required: title, columnId
    
    
    
    PUT: /boards/update_task_position
    
    updates position of task in a board
    
    required: column_id, task_id field
    
    
    
    DELETE: /projects/delete_project
    
    deletes the project and chat thread for project
    
    required: projectId
    
    
    
# users

    GET: /

    get all users
    
    
    
    GET: /me

    get current user based on token
    
    
    
    GET: /:pid

    get user by id
    
    
    
    GET: /friends/:uid
 
    get friends by user id
    
    
    
    GET: /search
 
    returns user based on given string
    
    required query param: q (search string)
    
    
    
    GET: /all
    
    returns all projects, posts and resources for the provided userId
    
    required query params: 
         userId (defaults to sender id),
         page (def: 1)
         filter (def: none)
         order (def: popular)
         reverse (def: false)
 
# messages

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
    
    
# resources


    GET: /
    
    get resources:
    
    required query params: 
         page (def: 1)
         filter (def: none)
         order (def: popular)
         reverse (def: false)
    
    
    
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
    
    
    POST /save_resource
    
    save resource
    
    required: rId
    
    
    DELETE /save_resource
        
    un-save resource
        
    required: rId
    
    
    DELETE: /delete_resource
    
    deletes a resource
    
    required: userId, resourceId
    
    
    
    DELETE: /delete_tag
    
    deletes a tag from a resource
    
    required: tagId, rId
    
    
    
    PUT: /update_resource
    
    updates a resource
    
    required: resource object with description, link, title, and r_id fields
    
    
# search


    GET: /
    
    searches database for resources, users, posts and projects
    
    required params: q: search string
