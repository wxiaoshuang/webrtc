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
  let username = query.username;
  let room = query.room;
  console.log(username+'连接了');
  if(clients.some(v => v.userId === socket.id)) {
    return;
  }
  socket.join(room);
  clients.push({userId: socket.id,username});
  if(clients.length>=2) {
    io.sockets.in(room).emit('ready');
  }
  socket.emit('joined');
  socket.broadcast.to(room).emit('join',{username });
  io.sockets.in(room).emit('clients',clients);
  socket.on('message',function (data) {
    socket.broadcast.to(room).emit('message',data);
  })
  // 收到对等连接创建的消息
  socket.on('pc message', function(data) {
    socket.to(data.to.userId).emit('pc message',data)
    // socket.broadcast.to(room).emit('pc message', data);
  })
  // 发私信,发起视频互动的请求
  socket.on('interact', function(data) {
      socket.to(data.to.userId).emit('interact',data)
  })
  // 对方同意视频互动
  socket.on('agree interact', function(data) {
    socket.to(data.from.userId).emit('agree interact',data)
    // 更新互动的状态
    // clients = clients.map(v => {
    //   if (v.userId === data.from.userId || v.userId === data.to.userId) {
    //     return {...v, isLive: true}
    //   } else {
    //     return v;
    //   }
    // })
    // io.sockets.in(room).emit('clients',clients);
  })
  socket.on('refuse interact', function(data) {
    socket.to(data.from.userId).emit('refuse interact',data)
  })
  socket.on('stop interact', function(data) {
    socket.to(data.to.userId).emit('stop interact',data)
    // // 更新互动的状态
    // clients = clients.map(v => {
    //   if (v.userId === data.from.userId || v.userId === data.to.userId) {
    //     return {...v, isLive: true}
    //   } else {
    //     return v;
    //   }
    // })
    // io.sockets.in(room).emit('clients',clients);
  })
  socket.on('leave', function(data) {
    socket.emit('left');
    socket.broadcast.to(room).emit('leave',{userId: socket.id, username });
    clients = clients.filter(v => v.userId !== socket.id);
    io.sockets.in(room).emit('clients',clients);
  })
  socket.on('disconnect', function() {
    console.log(username+'断开连接了');
    clients = clients.filter(v => v.userId !== socket.id);
    io.sockets.in(room).emit('clients',clients);
  })
});
server.listen(9000,function() {
  console.log('app is listening to 9000')
});
