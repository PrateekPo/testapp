const socket = io();
let localStream;
let peers = {};
let currentRoom;
let currentUser;
let isAudioMuted = false;
let isVideoMuted = false;

function generateRoomId() {
    return Math.random().toString(36).substring(2, 15);
}

async function joinRoom() {
    const username = document.getElementById('username').value.trim();
    let roomId = document.getElementById('room-id').value.trim();
    
    if (!username) {
        alert('Please enter your name');
        return;
    }
    
    if (!roomId) {
        roomId = generateRoomId();
    }
    
    currentUser = username;
    currentRoom = roomId;
    
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        
        document.getElementById('local-video').srcObject = localStream;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-screen').style.display = 'grid';
        document.getElementById('room-info').textContent = `Room: ${roomId}`;
        
        socket.emit('join-room', roomId, socket.id, username);
        
    } catch (error) {
        alert('Could not access camera/microphone: ' + error.message);
    }
}

function createPeer(userId, userName, initiator = false) {
    const peer = new SimplePeer({
        initiator,
        trickle: false,
        stream: localStream
    });
    
    peer.on('signal', (signal) => {
        socket.emit('signal', {
            signal,
            to: userId
        });
    });
    
    peer.on('stream', (stream) => {
        addVideoStream(userId, userName, stream);
    });
    
    peer.on('close', () => {
        removeVideoStream(userId);
    });
    
    peers[userId] = peer;
    return peer;
}

function addVideoStream(userId, userName, stream) {
    const videoContainer = document.createElement('div');
    videoContainer.className = 'remote-video-container';
    videoContainer.id = `video-${userId}`;
    
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    
    const label = document.createElement('span');
    label.className = 'video-label';
    label.textContent = userName;
    
    videoContainer.appendChild(video);
    videoContainer.appendChild(label);
    document.getElementById('remote-videos').appendChild(videoContainer);
}

function removeVideoStream(userId) {
    const videoElement = document.getElementById(`video-${userId}`);
    if (videoElement) {
        videoElement.remove();
    }
    if (peers[userId]) {
        peers[userId].destroy();
        delete peers[userId];
    }
}

function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (message) {
        socket.emit('chat-message', currentRoom, message, currentUser);
        input.value = '';
    }
}

function addChatMessage(data) {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    
    messageDiv.innerHTML = `
        <span class="chat-username">${data.userName}</span>
        <span class="chat-timestamp">${data.timestamp}</span>
        <div>${data.message}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function toggleMute() {
    isAudioMuted = !isAudioMuted;
    localStream.getAudioTracks()[0].enabled = !isAudioMuted;
    document.getElementById('mute-btn').textContent = isAudioMuted ? '🔇' : '🎤';
}

function toggleVideo() {
    isVideoMuted = !isVideoMuted;
    localStream.getVideoTracks()[0].enabled = !isVideoMuted;
    document.getElementById('video-btn').textContent = isVideoMuted ? '📹❌' : '📹';
}

function leaveRoom() {
    Object.values(peers).forEach(peer => peer.destroy());
    peers = {};
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    
    document.getElementById('main-screen').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('remote-videos').innerHTML = '';
    document.getElementById('chat-messages').innerHTML = '';
    
    socket.disconnect();
    socket.connect();
}

// Socket event listeners
socket.on('user-connected', (userId, userName) => {
    createPeer(userId, userName, true);
});

socket.on('existing-users', (users) => {
    users.forEach(user => {
        createPeer(user.socketId, user.name, true);
    });
});

socket.on('signal', (data) => {
    if (peers[data.from]) {
        peers[data.from].signal(data.signal);
    }
});

socket.on('user-disconnected', (userId) => {
    removeVideoStream(userId);
});

socket.on('chat-message', (data) => {
    addChatMessage(data);
});

// Enter key for chat
document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Enter key for room join
document.getElementById('room-id').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinRoom();
    }
});
