var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});
let clients = [];
io.on('connection', function (socket) {
  let query = socket.handshake.query;
  let username = socket.handshake.query.username;
  let room = socket.handshake.query.room;
  console.log(username+'连接了');
  if(clients.some(v => v.userId === socket.id)) {
    return;
  }
  socket.join(room);
  clients.push({userId: socket.id,username});
  socket.emit('joined');
  socket.broadcast.to(room).emit('join',{username });
  io.sockets.in(room).emit('clients',clients);
  socket.on('disconnect', function() {
    console.log(username+'断开连接了');
    clients = clients.filter(v => v.userId !== socket.id);
    io.sockets.in(room).emit('clients',clients);
  })
});
server.listen(9000,function() {
  console.log('app is listening to 9000')
});
