const { validationResult } = require('express-validator');
const db = require('../queries');
const {accessLogger, errorLogger} = require('../logger');

// socket controllers in this file

const saveMessageToDB = async(socket, message, io) => {

    const senderId = socket.body.decoded.u_id;
    const threadId = message.t_id;
    const incomingMessage = message;
    try {
        let isAllowed = await db.query('SELECT * from threadconnections where user_id = $1 AND thread_id = $2', [senderId, threadId]);
        console.log(socket.id);
        console.log(socket.rooms);
        console.log(isAllowed.rows);
        if (!isAllowed.rows.length) {
            return io.to(socket.id).emit('chat-message', {message: "Unauthorized thread access, this instance will be reported", m_id: new Date().toISOString(), username: 'marvin', time_sent: new Date(0).toISOString()})
        }
    } catch (e) {
        errorLogger.error(`Unathorized thread access by u_id: ${senderId}\n\n${e}`);
        return io.to(socket.request.headers.referer).emit('chat-message', {message: "failed to send message", m_id: new Date().toISOString(), username: 'marvin', time_sent: new Date(0).toISOString()})
    }
    let createdMessage;
    try {
        createdMessage = await db.query('INSERT INTO messages (message, sender, thread) VALUES ($1, $2, $3) RETURNING m_id, time_sent, message, sender',
            [incomingMessage.message, senderId, threadId]);
        createdMessage = createdMessage.rows[0];
        console.log(createdMessage);
        createdMessage.username = socket.body.decoded.username;
    } catch (e) {
        errorLogger.error('FAILED TO SAVE MESSAGE: ' + e);
        return io.to(socket.id).emit('chat-message', {message: "failed to send message: ", m_id: new Date().toISOString(), username: 'marvin', time_sent: new Date(0).toISOString()})
    }
    io.to(socket.request.headers.referer).emit('chat-message', createdMessage);

};

exports.saveMessageToDB = saveMessageToDB;