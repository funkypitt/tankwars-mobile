import { WebSocketServer } from 'ws';

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });

const rooms = new Map(); // roomCode -> { players: [ws, ws], state }
const waiting = []; // queue of players waiting to be matched

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'join':
        handleJoin(ws, msg);
        break;
      case 'move':
        handleMove(ws, msg);
        break;
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    // Remove from waiting queue
    const idx = waiting.indexOf(ws);
    if (idx !== -1) waiting.splice(idx, 1);

    // Notify opponent if in a room
    for (const [code, room] of rooms) {
      const playerIdx = room.players.indexOf(ws);
      if (playerIdx !== -1) {
        const opponent = room.players[1 - playerIdx];
        if (opponent && opponent.readyState === 1) {
          opponent.send(JSON.stringify({ type: 'opponent_disconnected' }));
        }
        rooms.delete(code);
        break;
      }
    }
  });
});

function handleJoin(ws, msg) {
  if (msg.roomCode) {
    // Join specific room
    const room = rooms.get(msg.roomCode);
    if (room && room.players.length < 2) {
      room.players.push(ws);
      ws.room = msg.roomCode;
      ws.playerId = 1;
      ws.send(JSON.stringify({ type: 'assigned', playerId: 1, roomCode: msg.roomCode }));
      startGame(room);
    } else {
      ws.send(JSON.stringify({ type: 'error', message: 'Room not found or full' }));
    }
  } else {
    // Auto-matchmaking
    if (waiting.length > 0) {
      const opponent = waiting.shift();
      if (opponent.readyState !== 1) {
        // Opponent disconnected, try again
        waiting.push(ws);
        return;
      }

      const roomCode = generateRoomCode();
      const room = { players: [opponent, ws], state: {} };
      rooms.set(roomCode, room);

      opponent.room = roomCode;
      opponent.playerId = 0;
      ws.room = roomCode;
      ws.playerId = 1;

      opponent.send(JSON.stringify({ type: 'assigned', playerId: 0, roomCode }));
      ws.send(JSON.stringify({ type: 'assigned', playerId: 1, roomCode }));

      setTimeout(() => startGame(room), 500);
    } else {
      waiting.push(ws);
      const roomCode = generateRoomCode();
      ws.room = roomCode;
      ws.playerId = 0;

      const room = { players: [ws], state: {} };
      rooms.set(roomCode, room);

      ws.send(JSON.stringify({ type: 'assigned', playerId: 0, roomCode }));
    }
  }
}

function startGame(room) {
  for (const player of room.players) {
    if (player.readyState === 1) {
      player.send(JSON.stringify({ type: 'start' }));
    }
  }
}

function handleMove(ws, msg) {
  const roomCode = ws.room;
  if (!roomCode) return;
  const room = rooms.get(roomCode);
  if (!room) return;

  const opponentIdx = 1 - ws.playerId;
  const opponent = room.players[opponentIdx];
  if (opponent && opponent.readyState === 1) {
    opponent.send(JSON.stringify({
      type: 'move',
      angle: msg.angle,
      power: msg.power,
      weaponIndex: msg.weaponIndex,
    }));
  }
}

console.log(`Tank Wars server running on ws://localhost:${PORT}`);
console.log('Waiting for players...');
