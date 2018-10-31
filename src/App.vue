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
                  <el-button v-if="item.userId !== socket.id && isTeacher" type="text" size="mini"
                             @click="interact(item)" :disabled="getStatus(item)">互动
                  </el-button>
                  <el-button v-if="item.userId !== socket.id && isTeacher" type="text" size="mini" @click="forbidTalk">
                    禁言
                  </el-button>
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
        <video autoplay playsinline ref="localVideo" controls id="local-video"></video>
      </div>
    </div>
    <div>
      <h4>列表渲染</h4>
      <ul class="others">
        <li v-for="(item, index) in biPeersList" :key="index">
          <h4>{{item.other.username}}
            <el-button type="primary" @click="stopInteract(item, index)" style="float:right;">结束互动</el-button>
          </h4>
          <video autoplay playsinline controls :ref="'remoteVideo'+item.other.userId"
                 :id="'remoteVideo'+item.other.userId"></video>
        </li>
      </ul>
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
          'iceServers': [
            {'urls': 'stun:stun.l.google.com:19302'},
            {'urls': 'turn:numb.viagenie.ca:3478', username: "REMOVED", credential: "REMOVED"}]
        },
        offerOptions: {
          offerToReceiveVideo: 1
        },
        biPeersList: [],
        peerList: Object.create(null),
        pc: null,
        localPc1: null,
        localPc2: null,
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
        remoteVideo3: null,
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
      // 获取互动的状态
      getStatus(item) {
        return !!this.peerList[item.userId]
      },
      // creates local MediaStream.
      startAction(callback) {
        navigator.mediaDevices.getUserMedia(this.mediaStreamConstraints).then((stream) => {
          this.gotLocalMediaStream(stream, callback)
        }).catch(this.handleLocalMediaStreamError)
      },
      gotLocalMediaStream(stream, callback) {
        this.localVideo = this.$refs.localVideo;
        this.localVideo.srcObject = stream;
        this.localStream = stream;
        window.localStream = stream;
        if (callback && typeof callback === 'function') {
          callback && callback();
        }
        this.trace('Received local stream.');
      },
      handleRemoteMediaStreamAdded(pc, event) {
        pc.remoteStream = event.stream;
        let remoteVideo = this.$refs['remoteVideo' + pc.other.userId][0];
        remoteVideo.srcObject = event.stream;
        remoteVideo.addEventListener('loadedmetadata', () => {
          remoteVideo.play();
        })
        console.log('biPeersList', this.biPeersList);
        this.remoteStream = event.stream;
        this.trace('Received remote stream from ' + pc.other.username);
      },
      handleLocalMediaStreamError() {
        console.log('本地视频采集出错');
      },
      handleRemoteStreamRemoved(pc, event) {
        this.trace('Remote stream  removed event', pc.other.username);
      },
      sendPcMessage(PcMessage) {
        let from = {userId: this.socket.id, username: this.form.username};
        let to = this.pcMsgTo;
        this.socket.emit('pc message', {from, to, pcMsg: PcMessage});
      },
      // A和B建立连接，A和C建立连接，收到的B和C的消息需要进行区分
      signalingMessageCallback(message) {
        let otherId = message.from.userId; // 对方的id
        let pc = this.peerList[otherId];
        message = message.pcMsg;
        if (message.type === 'offer') {
          console.log('signalingMessageCallback offer', message);
          pc.setRemoteDescription(new RTCSessionDescription(message)).then(() => {
            pc.createAnswer()
              .then((description) => this.createdAnswerSuccess(pc, description))
              .catch(this.setSessionDescriptionError);
          }).catch(this.logError)
        } else if (message.type === 'answer') {
          console.log('收到了answer')
          console.log('pc', pc)
          pc.setRemoteDescription(new RTCSessionDescription(message), function () {
          }, this.logError)
        } else if (message.type === 'candidate') {
          let candidate = new RTCIceCandidate({
            sdpMLineIndex: message.label,
            candidate: message.candidate
          });
          pc.addIceCandidate(candidate).catch(err => {
            console.log('addIceCandidate-error', err)
          });
        }
      },
      createdAnswerSuccess(pc, description) {
        pc.setLocalDescription(description).then(() => {
          this.sendPcMessage(pc.localDescription);
          this.setLocalDescriptionSuccess(description, 'answer');
          this.trace('local answer psd set.');
        }).catch(this.setSessionDescriptionError);
      },
      // 创建对等连接
      createPeerConnection(isCreatedOffer, data) {
        let other = isCreatedOffer ? data.to : data.from; // 对方
        if (!this.peerList[other.userId]) {
          let pc = new RTCPeerConnection(this.pcConfig);
          pc.from = data.from;
          pc.to = data.to;
          pc.isSelf = isCreatedOffer; // 是否是自己发起
          pc.other = isCreatedOffer ? data.to : data.from; // 对方
          this.peerList[other.userId] = pc;
          this.biPeersList.push(pc);
          this.createConnect(isCreatedOffer, pc)
        }
      },
      createConnect(isCreatedOffer, pc) {
        pc.addEventListener('icecandidate', event => {
          console.log('icecandidate event:', event);
          if (event.candidate) {
            this.sendPcMessage({
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
          pc.addStream((this.localStream));
        } else {
          this.startAction(this.addStreamToLocalPc(pc))
        }
        pc.addEventListener('addstream', (event) => {
          console.log('addstream');
          this.handleRemoteMediaStreamAdded(pc, event)
        });
        pc.addEventListener('removestream', (event) => {
          return this.handleRemoteStreamRemoved(pc, event)
        })
        // 创建offer,生成本地会话描述,如果是视频接收方，不需要生成offer
        if (isCreatedOffer) {
          pc.createOffer(this.offerOptions).then((description) => this.createdOfferSuccess(pc, description)).catch(this.logError);
        }
      },
      addStreamToLocalPc(pc) {
        return () => {
          pc.addStream((this.localStream));
        }
      },
      // 创建offer,生成本地会话描述
      createdOfferSuccess(pc, description) {
        // 用sd生成localPc的本地描述，remotePc的远程描述
        pc.setLocalDescription(description)
          .then(() => {
            this.sendPcMessage(pc.localDescription);
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
        // 开启互动之前,需要先开启视频采集
        if(!this.localStream) {
            this.startAction(() => {
              this.socket.emit('interact', {from: {username: this.form.username, userId: this.socket.id}, to: user})
              this.trace(`${this.form.username}向${user.username}发起了视频互动的请求`);
            })
        } else {
          this.socket.emit('interact', {from: {username: this.form.username, userId: this.socket.id}, to: user})
          this.trace(`${this.form.username}向${user.username}发起了视频互动的请求`);
        }
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
        if(this.onlineClients.some(v => v.username === this.form.username)) {
          this.$message('用户已经加入')
          return
        }
        let v = this;
        this.socket = io.connect(url, {query: {username: this.form.username, room: 'hello'}});
        // 其他用户加入聊天室
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
          if (this.biPeersList[data.userId]) {
            this.biPeersList[data.userId].close()
            delete this.biPeersList[data.userId]
          }
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
        // 监听到对方结束互动
        this.socket.on('stop interact', data => {
          let part =  data.from
          this.$message({type: 'info', message: `${part.username}停止了和您互动，连接即将断开`, duration: 1500})
          console.log('this.biPeersList', this.biPeersList);
          this.peerList[data.from.userId].close();
          this.peerList[data.from.userId] = null;
          let index = this.biPeersList.findIndex(v => v.other.userId === part.userId)
          if (index > -1) {
            this.biPeersList[index].close()
            this.biPeersList.splice(index, 1)
          }
        })
      },
      stopInteract(item, index) {
        this.socket.emit('stop interact', {from: {username: this.form.username, userId: this.socket.id}, to:item.other})
        this.biPeersList.splice(index, 1)
        this.peerList[item.other.userId].close();
        this.peerList[item.other.userId] = null
      },
      init() {
        this.localVideo = this.$refs.localVideo;
      },
      trace(text, data = '') {
        text = text.trim();
        const now = (window.performance.now() / 1000).toFixed(3);
        console.log(now, text, data);
      }
    },
    beforeDestroy() {
      this.biPeersList = [];
      for (let k in this.peerList) {
        this.peerList[k].close();
        this.peerList[k] = null;
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

  video {
    width: 320px;
    height: 240px;
  }

  .others li {
    float: left;
    margin-right: 20px;
  }

  .info {
    width: 400px;
  }

  .web-rtc {
    width: 320px;
  }

  .web-rtc video {
    width: 100%;
  }

  #chat {
    width: 400px;
    height: 400px;
    border: 1px solid yellow;
  }
</style>
