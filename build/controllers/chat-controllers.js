"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const queries_1 = __importDefault(require("../postgres/queries"));
const { errorLogger } = require('../logger');
const saveMessageToDB = (socket, message, io) => __awaiter(void 0, void 0, void 0, function* () {
    const senderId = socket.body.decoded.u_id;
    const threadId = message.t_id;
    const incomingMessage = message;
    let isAllowed;
    try {
        isAllowed = yield queries_1.default.query('SELECT * from threadconnections WHERE thread_id = $1', [threadId]);
        if (!isAllowed.rows.find((user) => user.user_id === senderId)) {
            errorLogger.error(`Unathorized thread access by u_id: ${senderId}`);
            return io.to(socket.body.decoded.u_id).emit('chat-message', {
                message: 'Unauthorized thread access, this instance will be reported',
                m_id: new Date().toISOString(),
                username: 'marvin',
                time_sent: new Date(0).toISOString(),
            });
        }
    }
    catch (e) {
        errorLogger.error(`Failed to send message: ` + e);
        return io.to(socket.body.decoded.u_id).emit('chat-message', {
            message: 'failed to send message',
            m_id: new Date().toISOString(),
            username: 'marvin',
            time_sent: new Date(0).toISOString(),
        });
    }
    let createdMessage;
    try {
        let newMessage = yield queries_1.default.query('INSERT INTO messages (message, sender, thread) ' +
            'VALUES ($1, $2, $3) ' +
            'RETURNING m_id, time_sent, message, sender', [incomingMessage.message, senderId, threadId]);
        createdMessage = newMessage.rows[0];
        createdMessage.username = socket.body.decoded.username;
    }
    catch (e) {
        errorLogger.error('FAILED TO SAVE MESSAGE: ' + e);
        return io.to(socket.body.decoded.u_id).emit('chat-message', {
            message: 'failed to send message: ',
            m_id: new Date().toISOString(),
            username: 'marvin',
            time_sent: new Date(0).toISOString(),
        });
    }
    message.activeUsers.map((user) => {
        console.log('sending to room ' + user.u_id + ' by: ' + senderId);
        io.to(String(user.u_id)).emit('notification', {
            type: 'message',
            message: `${createdMessage.username} has sent you a message`,
            link: `${socket.request.headers.room.slice(-1)}`,
        });
    });
    io.to(socket.request.headers.room).emit('chat-message', createdMessage);
});
module.exports = {
    saveMessageToDB,
};
//# sourceMappingURL=chat-controllers.js.map