'use strict';

const { WebSocketServer } = require('ws');

let wss = null;

function initWebSocket(server, path = '/ws') {
  wss = new WebSocketServer({ server, path });
  wss.on('connection', (socket) => {
    socket.send(
      JSON.stringify({
        type: 'welcome',
        message: 'Connected to GradeLogic realtime channel',
      }),
    );
  });
}

function broadcast(eventType, payload) {
  if (!wss) return;
  const frame = JSON.stringify({
    type: eventType,
    payload,
    at: new Date().toISOString(),
  });

  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(frame);
    }
  }
}

module.exports = {
  broadcast,
  initWebSocket,
};
