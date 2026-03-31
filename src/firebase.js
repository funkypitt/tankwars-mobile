import { initializeApp } from 'firebase/app';
import {
  getDatabase, ref, set, get, onValue, onChildAdded,
  push, remove, onDisconnect, serverTimestamp, update,
} from 'firebase/database';

const firebaseConfig = {
  projectId: 'tankwars-mobile',
  appId: '1:1006160242389:web:6b476c740b22a8c682a45c',
  storageBucket: 'tankwars-mobile.firebasestorage.app',
  apiKey: 'AIzaSyAXBa8oFAuXFUge2HrpZ3N-5kUrkiDJnS0',
  authDomain: 'tankwars-mobile.firebaseapp.com',
  messagingSenderId: '1006160242389',
  databaseURL: 'https://tankwars-mobile-default-rtdb.firebaseio.com',
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export class FirebaseMultiplayer {
  constructor(game) {
    this.game = game;
    this.roomCode = null;
    this.playerId = null; // 0 or 1
    this.roomRef = null;
    this.unsubscribers = [];
  }

  // Generate a short room code
  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  // Create a new room and wait for opponent
  async createRoom() {
    this.roomCode = this.generateRoomCode();
    this.playerId = 0;
    this.roomRef = ref(db, `rooms/${this.roomCode}`);

    await set(this.roomRef, {
      createdAt: Date.now(),
      status: 'waiting',
      players: {
        0: { joined: true, ready: false },
      },
      settings: {
        rounds: this.game.totalRounds,
        crumble: this.game.crumblePercent,
        wallType: this.game.wallType,
        windLevel: this.game.windLevel,
      },
    });

    // Clean up room on disconnect
    onDisconnect(ref(db, `rooms/${this.roomCode}/players/0`)).remove();
    onDisconnect(ref(db, `rooms/${this.roomCode}/status`)).set('abandoned');

    // Listen for player 2 joining
    const playerRef = ref(db, `rooms/${this.roomCode}/players/1`);
    const unsub = onValue(playerRef, (snapshot) => {
      if (snapshot.exists() && snapshot.val().joined) {
        this.game.showMessage('Opponent joined!', 60);
        // Start game after short delay
        setTimeout(() => this.startOnlineGame(), 500);
      }
    });
    this.unsubscribers.push(() => unsub());

    return this.roomCode;
  }

  // Join an existing room
  async joinRoom(code) {
    this.roomCode = code.toUpperCase();
    this.playerId = 1;
    this.roomRef = ref(db, `rooms/${this.roomCode}`);

    // Check room exists and is waiting
    const snapshot = await get(this.roomRef);
    if (!snapshot.exists()) {
      throw new Error('Room not found');
    }
    const room = snapshot.val();
    if (room.status !== 'waiting') {
      throw new Error('Room is not available');
    }

    // Apply host's settings
    if (room.settings) {
      this.game.totalRounds = room.settings.rounds || 10;
      this.game.crumblePercent = room.settings.crumble || 50;
      this.game.wallType = room.settings.wallType || 0;
      this.game.windLevel = room.settings.windLevel || 2;
    }

    // Join the room
    await update(ref(db, `rooms/${this.roomCode}/players/1`), {
      joined: true,
      ready: false,
    });
    await set(ref(db, `rooms/${this.roomCode}/status`), 'playing');

    // Clean up on disconnect
    onDisconnect(ref(db, `rooms/${this.roomCode}/players/1`)).remove();

    // Start game
    setTimeout(() => this.startOnlineGame(), 500);
  }

  // Auto-matchmaking: find an open room or create one
  async autoMatch() {
    // Look for waiting rooms
    const roomsRef = ref(db, 'rooms');
    const snapshot = await get(roomsRef);

    if (snapshot.exists()) {
      const rooms = snapshot.val();
      for (const [code, room] of Object.entries(rooms)) {
        if (room.status === 'waiting' && room.players && !room.players[1]) {
          // Found an open room, join it
          try {
            await this.joinRoom(code);
            return code;
          } catch {
            // Room might have been taken, continue
          }
        }
      }
    }

    // No open rooms, create one
    return await this.createRoom();
  }

  startOnlineGame() {
    this.game.isOnline = true;
    this.game.playerId = this.playerId;
    this.listenForMoves();
    this.listenForDisconnect();
    this.game.startNewGame();
  }

  // Listen for opponent's moves
  listenForMoves() {
    const movesRef = ref(db, `rooms/${this.roomCode}/moves`);
    const unsub = onChildAdded(movesRef, (snapshot) => {
      const move = snapshot.val();
      if (move.player !== this.playerId) {
        // Opponent's move - apply it
        this.game.receiveMove(move);
        // Clean up processed move
        remove(snapshot.ref);
      }
    });
    this.unsubscribers.push(() => unsub());
  }

  // Listen for opponent disconnect
  listenForDisconnect() {
    const opponentId = this.playerId === 0 ? 1 : 0;
    const opponentRef = ref(db, `rooms/${this.roomCode}/players/${opponentId}`);
    const unsub = onValue(opponentRef, (snapshot) => {
      if (!snapshot.exists() && this.game.isOnline) {
        this.game.showMessage('Opponent disconnected', 180);
        this.game.isOnline = false;
        this.game.state = 'menu';
        this.cleanup();
      }
    });
    this.unsubscribers.push(() => unsub());
  }

  // Send a move to the opponent
  async sendMove(moveData) {
    const movesRef = ref(db, `rooms/${this.roomCode}/moves`);
    await push(movesRef, {
      player: this.playerId,
      ...moveData,
      timestamp: Date.now(),
    });
  }

  // Clean up room and listeners
  async cleanup() {
    for (const unsub of this.unsubscribers) {
      try { unsub(); } catch {}
    }
    this.unsubscribers = [];

    if (this.roomRef) {
      try {
        await remove(this.roomRef);
      } catch {}
    }
    this.roomRef = null;
    this.roomCode = null;
    this.playerId = null;
  }
}
