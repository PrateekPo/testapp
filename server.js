const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

// Explicit route for root path
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId, userId, userName) => {
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add({ id: userId, name: userName, socketId: socket.id });
    
    socket.to(roomId).emit('user-connected', userId, userName);
    
    // Send existing users to new user
    const existingUsers = Array.from(rooms.get(roomId)).filter(user => user.socketId !== socket.id);
    socket.emit('existing-users', existingUsers);
  });

  socket.on('signal', (data) => {
    socket.to(data.to).emit('signal', {
      signal: data.signal,
      from: socket.id
    });
  });

  socket.on('chat-message', (roomId, message, userName) => {
    io.to(roomId).emit('chat-message', {
      message,
      userName,
      timestamp: new Date().toLocaleTimeString()
    });
  });

  socket.on('disconnect', () => {
    // Remove user from all rooms
    rooms.forEach((users, roomId) => {
      const userArray = Array.from(users);
      const userIndex = userArray.findIndex(user => user.socketId === socket.id);
      if (userIndex !== -1) {
        const user = userArray[userIndex];
        users.delete(user);
        socket.to(roomId).emit('user-disconnected', user.id);
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
