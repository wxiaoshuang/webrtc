<template>
  <div id="app">
    <div class="info">
      <el-form ref="form" :model="form" label-width="80px">
        <el-form-item label="用户名" prop="username">
          <el-input  v-model="form.username"></el-input>
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input  v-model="form.password"></el-input>
        </el-form-item>
        <el-button type="primary" @click="joinRoom" >加入聊天室</el-button>
      </el-form>
    </div>
    <div class="scene">
      <div id="chat">
        <ul>
          <li v-for="(item,index) in messages" :key="index">
            <span>{{item.username}}</span>
            <span>{{item.msg}}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import io from 'socket.io-client';
export default {
  name: 'App',
  data() {
    return {
       onlineClients: [],
       webrtc: null,
       socket: null,
       messages: [],
       form: {
        username: '',
        password: ''
       }
    };
  },

  methods:{
    updateChatMessage(data) {
      this.messages.push(data);
    },
    joinRoom() {
      let url = 'http://localhost:9000';
      if(!this.form.username) {
        this.$message('请输入用户名');
        return;
      }
      this.socket = io.connect(url,{query: {username: this.form.username, room: 'hello'}});
      // 其他用户加入
      this.socket.on('join', function(data) {
         this.updateChatMessage({type:'sys',...data});
      });
      // 自己加入成功
      this.socket.on('joined', function() {
        // this.updateChatMessage();
      })
      // 更新在线人数列表
      this.socket.on('clients',function(data) {
        this.onlineClients = data;

      })
        // console.log('this.socket', this.socket);
    }
  },

  mounted() {
    this.init();
  }

}
</script>

<style>
#app {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
.info {
  width: 400px;
}
  #chat {
    width: 400px;
    height: 400px;
    border: 1px solid yellow;
  }
</style>
