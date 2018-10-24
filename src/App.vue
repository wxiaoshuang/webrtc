<template>
  <div id="app">
    <div class="info">
      <el-form ref="form" :model="form" label-width="80px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username"></el-input>
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password"></el-input>
        </el-form-item>
        <el-button type="primary" @click="joinRoom" size="small" :disabled="socket && socket.connected">加入聊天室
        </el-button>
        <el-button type="primary" @click="leaveRoom" size="small" :disabled="!(socket && socket.connected)">离开聊天室
        </el-button>
        <el-button type="primary" @click="startAction" size="small"
                   :disabled="!(socket && socket.connected && isReady)">开始视频
        </el-button>
      </el-form>
    </div>
    <div class="scene">
      <div id="chat" v-show="socket && socket.connected">
        <el-tabs v-model="activeTab" @tab-click="tabClick">
          <el-tab-pane label="聊天" name="chatTab">
            <div>
              <ul class="chat-message">
                <li v-for="(item,index) in messages" :key="index">
                  <div v-if="item.type === 'sys' ">
                    <span class="el-icon-bell" style="color: yellow;"></span>
                    <span>{{item.msg}}</span>
                  </div>
                  <div v-else>
                    <span>{{item.username}}</span>
                    <span>{{item.msg}}</span>
                  </div>
                </li>
              </ul>
              <el-input type="textarea" v-model="sendingMsg" @keyup.enter.native="handleSendMesssage"></el-input>
              <el-button type="primary" size="small" @click="handleSendMesssage">发送</el-button>
            </div>

          </el-tab-pane>
          <el-tab-pane :label="'用户('+ onlineClients.length +')'" name="userTab">
            <ul class="clients-list">
              <li v-for="(item ,index) in onlineClients" :key="index">
                <div>
                  <span>{{item.username}}</span>
                  <el-button type="text" size="mini" v-if="isTeacher" @click="interact(item)">互动</el-button>
                  <el-button type="text" size="mini" v-if="isTeacher" @click="forbidTalk">禁言</el-button>
                </div>
              </li>
            </ul>
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>
    <div class="web-rtc">
      <div>
        <h4>本人</h4>
        <video autoplay playsinline  ref="localVideo" controls id="local-video"></video>
      </div>
      <div>
        <video autoplay playsinline ref="remoteVideo1"></video>
        <video autoplay playsinline ref="remoteVideo2"></video>
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
        pcConfig: {
          'iceServers': [{
            'urls': 'stun:stun.l.google.com:19302'
          }]
        },
        offerOptions: {
          offerToReceiveVideo: 1
        },
        biPeersList:[],
        localPc: null,
        localPc1: null,
        pcMsgTo: {},
        remotePc: null,
        isStarted: false,
        isTeacher: true,
        isReady: false,
        sendingMsg: '',
        activeTab: 'chatTab',
        onlineClients: [],
        webrtc: null,
        socket: null,
        messages: [],
        localVideo: null,
        remoteVideo1: null,
        remoteVideo2: null,
        localStream: null,
        remoteStream: null,
        remoteStreamNum: 0,
        mediaStreamConstraints: {
          video: true
        },
        form: {
          username: '',
          password: ''
        }
      };
    },
    methods: {
      // creates local MediaStream.
      startAction(callback) {
        navigator.mediaDevices.getUserMedia(this.mediaStreamConstraints).then((stream) => {
          this.gotLocalMediaStream(stream, callback)
        }).catch(this.handleLocalMediaStreamError)
      },
      gotLocalMediaStream(stream, callback) {
        let localVideo = document.getElementById('local-video')
        this.localVideo = this.$refs.localVideo;
        this.localVideo.srcObject = stream;
        this.localStream = stream;
        window.localStream = stream;
        if (callback && typeof callback === 'function') {
          callback && callback();
        }
        this.trace('Received local stream.');
      },
      handleRemoteMediaStreamAdded(event) {
        console.log('Remote stream  add event', event);
        if (this.remoteStreamNum <= 1) {
            this.remoteStreamNum++;
            this['remoteVideo'+ this.remoteStreamNum].srcObject = event.stream;
        }
        // this.remoteStream = event.stream;
        this.trace('Received remote stream. from '+ event.target.username);
      },
      handleRemoteStreamRemoved(event) {
        console.log('Remote stream  removed event', event);
      },
      sendPcMessage(PcMessage) {
        let from = {userId: this.socket.id, username: this.form.username};
        let to = this.pcMsgTo;
        this.socket.emit('pc message', {from, to, pcMsg: PcMessage});
      },
      signalingMessageCallback(message) {
        message = message.pcMsg;
        if (message.type === 'offer') {
          console.log('signalingMessageCallback offer', message);
          this.localPc.setRemoteDescription(new RTCSessionDescription(message)).then(() => {
            this.createAnswer()
          }).catch(this.logError)
        } else if (message.type === 'answer') {
          console.log('收到了answer')
          this.localPc.setRemoteDescription(new RTCSessionDescription(message), function () {
          }, this.logError)
        } else if (message.type === 'candidate') {
          let candidate = new RTCIceCandidate({
            sdpMLineIndex: message.label,
            candidate: message.candidate
          });
          this.localPc.addIceCandidate(candidate);
        }
      },
      //收到远端offer,创建answer
      createAnswer() {
        this.localPc.createAnswer()
          .then(this.createdAnswerSuccess)
          .catch(this.setSessionDescriptionError);
      },
      createdAnswerSuccess(description) {
        this.localPc.setLocalDescription(description).then(() => {
          this.sendPcMessage(this.localPc.localDescription);
          this.setLocalDescriptionSuccess(description, 'answer');
          this.trace('local answer psd set.');
        }).catch(this.setSessionDescriptionError);
      },
      createPc(isCreatedOffer,data) {
          if (!this.biPeersList.length || (this.biPeersList.length && this.biPeersList.some(v => v.other.userId === other.userId) )) {
            let localPc = new RTCPeerConnection(this.pcConfig);
            localPc.from = data.from;
            localPc.to = data.to;
            localPc.isSelf = isCreatedOffer; // 是否是自己发起
            localPc.other = isCreatedOffer? data.to: data.from; // 对方
            this.biPeersList.push(localPc);
          } else {
             return false;
          }
      },
      // 创建对等连接
      createPeerConnection(isCreatedOffer, data) {
        let pc = this.createPc(isCreatedOffer, data);
        if(!pc) {
          return;
        }
        this.localPc = this.biPeersList[this.biPeersList.length - 1];
        this.localPc.addEventListener('icecandidate', event => {
          console.log('icecandidate event:', event);
          if (event.candidate) {
            this.sendPcMessage({
              from: {userId: this.socket.id, username: this.form.username},
              type: 'candidate',
              label: event.candidate.sdpMLineIndex,
              id: event.candidate.sdpMid,
              candidate: event.candidate.candidate
            })
          } else {
            console.log('End of candidates.');
          }
        })
        if (this.localStream) {
          this.localPc.addStream((this.localStream));
        } else {
          this.startAction(this.addStreamToLocalPc)
        }
        this.localPc.addEventListener('addstream', this.handleRemoteMediaStreamAdded);
        this.localPc.addEventListener('removestream', this.handleRemoteStreamRemoved)
        // 创建offer,生成本地会话描述,如果是视频接收方，不需要生成offer
        if(isCreatedOffer) {
          this.localPc.createOffer(this.offerOptions).then(this.createdOfferSuccess).catch(this.logError);
        }
      },
      addStreamToLocalPc() {
        this.localPc.addStream((this.localStream));
      },
      // 创建offer,生成本地会话描述
      createdOfferSuccess(description) {
        // 用sd生成localPc的本地描述，remotePc的远程描述
        this.localPc.setLocalDescription(description)
          .then(() => {
            this.sendPcMessage(this.localPc.localDescription);
            this.setLocalDescriptionSuccess(description, 'offer');
            this.trace('local offer psd set.');
          }).catch(this.setSessionDescriptionError);
      },
      // 本地会话描述设置成功
      setLocalDescriptionSuccess(desc, type = 'offer') {
        // console.log('local desc', desc);
        // this.trace('setLocalDescription' + type + 'success', desc);
      },
      // 会话描述设置失败
      setSessionDescriptionError(err) {
        this.trace('set session Description error', err);
      },
      logError(err) {
        if (!err) return;
        if (typeof err === 'string') {
          console.warn(err);
        } else {
          console.warn(err.toString(), err);
        }
      },
      // 开始互动
      interact(user) {
        this.socket.emit('interact', {from: {username: this.form.username, userId: this.socket.id}, to: user})
        this.trace(`${this.form.username}向${user.username}发起了视频互动的请求`);
      },
      // 禁言
      forbidTalk() {

      },
      // 发送消息
      handleSendMesssage() {
        if (!this.sendingMsg) {
          return;
        }
        let data = {msg: this.sendingMsg, username: this.form.username}
        this.socket.emit('message', data)
        this.updateChatMessage(data);
        this.sendingMsg = '';
      },
      tabClick() {
      },
      updateChatMessage(data) {
        this.messages.push(data)
      },
      leaveRoom() {
        this.socket.emit('leave')
      },
      joinRoom() {
        let url = 'http://localhost:9000'
        if (!this.form.username) {
          this.$message('请输入用户名')
          return
        }
        let v = this;
        this.socket = io.connect(url, {query: {username: this.form.username, room: 'hello'}});
        // 其他用户加入
        this.socket.on('join', (data) => {
          this.updateChatMessage({msg: data.username + '加入了聊天室', type: 'sys'})
        });
        // 自己加入成功
        this.socket.on('joined', () => {
          console.log('i joined th room');
          // this.updateChatMessage();
        })
        this.socket.on('ready', () => {
          this.isReady = true;
        })
        // 自己离开了
        this.socket.on('left', () => {
          this.socket.disconnect();
          this.messages = [];
          this.onlineClients = [];
        })
        // 别人离开了
        this.socket.on('leave', data => {
          this.updateChatMessage({msg: data.username + '离开了聊天室', type: 'sys'})
        })
        // 更新在线人数列表
        this.socket.on('clients', (data) => {
          console.log('clients', data)
          v.onlineClients = data
        })
        this.socket.on('pc message', (data) => {
          this.trace('客户端收到了pc的消息', data);
          this.signalingMessageCallback(data)
        })
        // 收到别人发的聊天信息
        this.socket.on('message', data => {
          this.updateChatMessage(data);
        })
        //收到别人的要求视频互动的私信
        this.socket.on('interact', data => {
          this.$confirm(`${data.from.username}想和你视频互动，请接受`, '提示信息', {
            distinguishCancelAndClose: true,
            confirmButtonText: '接受',
            cancelButtonText: '拒绝'
          })
            .then(() => {
              // 同意和对方互动, 对方发起，自己接受
              this.socket.emit('agree interact', data)
              this.pcMsgTo = data.from;
              this.createPeerConnection(false, data);
            })
            .catch(() => {
              // 拒绝和对方互动
              this.socket.emit('refuse interact', data)
            });
        })
        // 对方同意了了和你视频互动，自己发起，对方接受
        this.socket.on('agree interact', data => {
          this.$message({type: 'success', message: `${data.to.username}接受了视频互动的请求`})
          this.pcMsgTo = data.to;
          this.trace(`${data.to.username}接受了视频互动的请求`);
          this.createPeerConnection(true, data)
        })
        // 对方拒绝了和你视频互动
        this.socket.on('refuse interact', data => {
          this.$message({type: 'warning', message: `${data.to.username}拒绝了视频互动的请求`})
          this.trace(`${data.to.username}拒绝了视频互动的请求`);
        })
      },
      init() {
        this.localVideo = this.$refs.localVideo;
        this.remoteVideo1 = this.$refs.remoteVideo1;
        this.remoteVideo2 = this.$refs.remoteVideo2;
      },
      trace(text, data = '') {
        text = text.trim();
        const now = (window.performance.now() / 1000).toFixed(3);
        console.log(now, text, data);
      }
    },
    mounted() {
      this.init()
    }

  }
</script>

<style>
  ul, li {
    list-style: none;
  }

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
