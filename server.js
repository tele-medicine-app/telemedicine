const http = require('http');
const WebSocket = require('ws');

// Simple fallback HTTP container status
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Telemedicine Secure Signaling Hub is Online\n');
});

const wss = new WebSocket.Server({ server });

// Track connected active room topologies
const rooms = new Map(); // roomId -> Set of WS client sockets

wss.on('connection', (ws) => {
  let currentRoom = null;
  let clientPeerId = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'join':
          currentRoom = data.roomId;
          clientPeerId = data.peerId;
          
          if (!rooms.has(currentRoom)) {
            rooms.set(currentRoom, new Set());
          }
          
          rooms.get(currentRoom).add(ws);
          ws.peerId = clientPeerId;
          
          console.log(`[ROOM JOIN] Peer ${clientPeerId} entered room: ${currentRoom}`);

          // Broadcast peer presence to everyone else in the room
          rooms.get(currentRoom).forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'peer-joined', peerId: clientPeerId }));
            }
          });
          break;

        case 'offer':
        case 'answer':
        case 'candidate':
          // Safely relay WebRTC signaling payloads to the matching counterparties
          if (rooms.has(currentRoom)) {
            rooms.get(currentRoom).forEach((client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
              }
            });
          }
          break;
      }
    } catch (err) {
      console.error('Signaling processing anomaly:', err);
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(ws);
      console.log(`[ROOM LEAVE] Peer ${clientPeerId} vacated room: ${currentRoom}`);
      
      // Notify remaining active session nodes
      rooms.get(currentRoom).forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'peer-left', peerId: clientPeerId }));
        }
      });
      
      if (rooms.get(currentRoom).size === 0) {
        rooms.delete(currentRoom);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Secure core connection bridge driving live on port: ${PORT}`);
});