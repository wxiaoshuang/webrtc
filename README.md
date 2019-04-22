# demo

> A  WebRTC  project

* npm install 安装依赖
* node run start在本地的9000端口启动后端服务
* npm run dev在8080端口开启前端项目
* 使用http://localhost:8080访问项目，输入用户名和密码，进入聊天室，在用户列表里面点击互动可以选择其他用户进行视频互动(可以通过再开一个窗口，再输入用户名和密码来模拟多人)
* 注意： 
    - 这个项目启动了两个本地node服务器，socket.io的访问地址是后端服务器也就是http://localhost:9000,如果需要部署到线上，需要将src/APP.vue的joinRoom的方法中的socket的url替换成线上服务器的地址，
    - src/APP.vue的data的pcConfig为了测试用的是google的stun服务器和我们公司的turn服务器，到时候需要替换成你们线上的stun服务器和turn服务器
    ```javascript
     pcConfig: {
        'iceServers': [
          {
            'url': 'stun:stun.l.google.com:19302'
          },
          {
            'url': 'turn:120.77.253.101:3478',
            'username': 'inter_user',
            'credential': 'power_turn'
          }
        ]
      }
    ```
