const { validationResult } = require('express-validator');
const db = require('../queries');
const {accessLogger, errorLogger} = require('../logger');
const dbNotifications = require('../db-utils/db-notifications');

const saveMessageToDB = async(socket, message, io) => {

    const senderId = socket.body.decoded.u_id;
    const threadId = message.t_id;
    const incomingMessage = message;
    let isAllowed;
    try {
        isAllowed = await db.query(
            'SELECT * from threadconnections WHERE thread_id = $1', [threadId]);
        if (!isAllowed.rows.find(user => user.user_id === senderId)) {
            errorLogger.error(`Unathorized thread access by u_id: ${senderId}\n\n${e}`);
            return io.to(socket.body.decoded.u_id).emit('chat-message', {message: "Unauthorized thread access, this instance will be reported", m_id: new Date().toISOString(), username: 'marvin', time_sent: new Date(0).toISOString()})
        }
    } catch (e) {
        errorLogger.error(`Failed to send message: ` + e);
        return io.to(socket.body.decoded.u_id).emit('chat-message', {message: "failed to send message", m_id: new Date().toISOString(), username: 'marvin', time_sent: new Date(0).toISOString()})
    }
    let createdMessage;
    try {
        createdMessage = await db.query(
            'INSERT INTO messages (message, sender, thread) ' +
            'VALUES ($1, $2, $3) ' +
            'RETURNING m_id, time_sent, message, sender',
            [incomingMessage.message, senderId, threadId]);
        createdMessage = createdMessage.rows[0];
        createdMessage.username = socket.body.decoded.username;
    } catch (e) {
        errorLogger.error('FAILED TO SAVE MESSAGE: ' + e);
        return io.to(socket.body.decoded.u_id).emit('chat-message', {message: "failed to send message: ", m_id: new Date().toISOString(), username: 'marvin', time_sent: new Date(0).toISOString()})
    }
    message.activeUsers
        .map(user => {
<<<<<<< HEAD
            console.log('sending to room ' + user.u_id + ' by: ' + senderId);
            io.to(user.u_id).emit('notification', {type: 'message', message: `${createdMessage.sender} has sent you a message`, link: `${socket.request.headers.room.slice(-1)}`});
=======
            console.log('sending to room ' + user.user_id + ' by: ' + senderId);
            io.to(user.user_id).emit('notification', {type: 'message', sender: senderId, thread :user.thread_id});
>>>>>>> parent of 046c8b1... socket notification update and message users online update
        }
    );
    io.to(socket.request.headers.room).emit('chat-message', createdMessage);
};

exports.saveMessageToDB = saveMessageToDB;