// collab-server/server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const Y = require("yjs");
const os = require("os"); // NEW: Needed for PTY
const pty = require("node-pty"); // NEW: The Terminal Engine

require('dotenv').config();
const mongoose = require('mongoose');
const Room = require('./models/Room');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Database'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-collab-key";

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

const activeDocs = new Map();
const roomUsers = new Map(); 
const activeTerminals = new Map(); // NEW: Tracks terminal processes per room

// Auto-Save System
setInterval(async () => {
  if (activeDocs.size === 0) return;
  for (const [roomId, doc] of activeDocs.entries()) {
    try {
      const state = Y.encodeStateAsUpdate(doc);
      await Room.findOneAndUpdate(
        { roomId },
        { ydocState: Buffer.from(state), lastUpdated: Date.now() },
        { upsert: true }
      );
    } catch (err) {
      console.error(`Auto-save error for room ${roomId}:`, err);
    }
  }
}, 5000); 

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("join-room", async ({ roomId, password, username }) => {
    try {
      let room = await Room.findOne({ roomId });
      
      if (room && room.password && room.password !== password) {
        socket.emit("auth-error", "Access Denied: Incorrect room password.");
        return; 
      }

      if (!room) {
        room = new Room({ roomId, password: password || null, owner: username, files: [], chatMessages: [] });
        await room.save();
      }

      socket.join(roomId);
      
      const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500'];
      const userColor = colors[Math.floor(Math.random() * colors.length)];
      const newUser = { id: socket.id, username: username || 'Anonymous', color: userColor };

      if (!roomUsers.has(roomId)) roomUsers.set(roomId, []);
      roomUsers.get(roomId).push(newUser);

      if (room.files && room.files.length > 0) socket.emit("file-tree-sync", room.files);
      if (room.chatMessages && room.chatMessages.length > 0) socket.emit("chat-history", room.chatMessages);

      if (!activeDocs.has(roomId)) {
        const doc = new Y.Doc();
        if (room.ydocState) {
          try { Y.applyUpdate(doc, new Uint8Array(room.ydocState)); } 
          catch(e) { console.error("Failed to parse saved code:", e); }
        }
        activeDocs.set(roomId, doc);
      }

      // ==========================================
      // NEW: INTERACTIVE TERMINAL INITIALIZATION
      // ==========================================
      if (!activeTerminals.has(roomId)) {
        const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
        const ptyProcess = pty.spawn(shell, [], {
          name: 'xterm-color',
          cols: 80,
          rows: 24,
          cwd: process.env.HOME || process.cwd(),
          env: process.env
        });

        // When the hidden server terminal outputs data, send it to the frontend
        ptyProcess.onData((data) => {
          io.to(roomId).emit("terminal-output", data);
        });

        activeTerminals.set(roomId, ptyProcess);
      }
      
      io.to(roomId).emit("room-users-update", roomUsers.get(roomId));

    } catch (error) {
      console.error("Error joining room:", error);
    }
  });

  // ==========================================
  // NEW: TERMINAL I/O LISTENERS
  // ==========================================
  socket.on("terminal-input", ({ roomId, input }) => {
    const ptyProcess = activeTerminals.get(roomId);
    if (ptyProcess) ptyProcess.write(input);
  });

  socket.on("terminal-resize", ({ roomId, cols, rows }) => {
    const ptyProcess = activeTerminals.get(roomId);
    if (ptyProcess) ptyProcess.resize(cols, rows);
  });

  // ==========================================
  // NEW: SMART RUN BUTTON LOGIC
  // ==========================================
  socket.on("run-code", ({ roomId, filename, code }) => {
    const ptyProcess = activeTerminals.get(roomId);
    if (!ptyProcess) return;

    // 1. Create a safe temporary folder for this room's files
    const roomDir = path.join(__dirname, 'temp', roomId);
    if (!fs.existsSync(roomDir)) {
      fs.mkdirSync(roomDir, { recursive: true });
    }

    // 2. Save the current code to a physical file on the server
    const filePath = path.join(roomDir, filename);
    fs.writeFileSync(filePath, code);

    // 3. Automatically type the run command into the terminal based on the language!
    let command = '';
    if (filename.endsWith('.js')) {
      command = `node "${filePath}"\r`;
    } else if (filename.endsWith('.py')) {
      command = `python "${filePath}"\r`;
    }

    if (command) {
      ptyProcess.write(command);
    }
  });

  socket.on("request-initial-code", (roomId) => {
    const doc = activeDocs.get(roomId);
    if (doc) socket.emit("code-update", Y.encodeStateAsUpdate(doc));
  });

  socket.on("request-file-tree", async (roomId) => {
    const room = await Room.findOne({ roomId });
    if (room && room.files && room.files.length > 0) socket.emit("file-tree-sync", room.files);
  });

  socket.on("request-room-users", (roomId) => {
    socket.emit("room-users-update", roomUsers.get(roomId) || []);
  });

  socket.on("file-tree-update", async ({ roomId, files }) => {
    await Room.findOneAndUpdate({ roomId }, { files, lastUpdated: Date.now() }, { upsert: true });
    socket.to(roomId).emit("file-tree-sync", files);
  });

  socket.on("code-update", ({ roomId, update }) => {
    socket.to(roomId).emit("code-update", update); 
    const doc = activeDocs.get(roomId);
    if (doc) Y.applyUpdate(doc, new Uint8Array(update));
  });

  socket.on("send-message", async ({ roomId, message }) => {
    const usersInRoom = roomUsers.get(roomId) || [];
    const user = usersInRoom.find(u => u.id === socket.id);
    if (user) message.sender = user.username; 
    io.to(roomId).emit("receive-message", message);
    await Room.findOneAndUpdate({ roomId }, { $push: { chatMessages: message }, lastUpdated: Date.now() });
  });

  socket.on("disconnecting", async () => {
    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) {
        let users = roomUsers.get(roomId) || [];
        users = users.filter(u => u.id !== socket.id);
        
        if (users.length === 0) {
          const doc = activeDocs.get(roomId);
          if (doc) {
            const state = Y.encodeStateAsUpdate(doc);
            await Room.findOneAndUpdate({ roomId }, { ydocState: Buffer.from(state), lastUpdated: Date.now() }, { upsert: true });
            activeDocs.delete(roomId); 
          }
          // NEW: Destroy the terminal process when the room is empty to save RAM
          const ptyProcess = activeTerminals.get(roomId);
          if (ptyProcess) {
            ptyProcess.kill();
            activeTerminals.delete(roomId);
          }
          roomUsers.delete(roomId);
        } else {
          roomUsers.set(roomId, users);
          io.to(roomId).emit("room-users-update", users);
        }
      }
    }
  });

  socket.on("disconnect", () => console.log(`Socket disconnected: ${socket.id}`));
});

// ==========================================
// RESTORED AUTHENTICATION & ROOM LOGIC
// ==========================================

app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: "Email or Username already taken." });
    }

    // Hash password and save
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();

    // Generate Token
    const token = jwt.sign({ id: newUser._id, username: newUser.username }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, username: newUser.username });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    // Generate Token
    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.status(200).json({ token, username: user.username });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/room/:roomId", async (req, res) => { 
    try {
        const room = await Room.findOne({ roomId: req.params.roomId });
        
        // Return 404 if it doesn't exist
        if (!room) return res.status(404).json({ error: "Room not found" });
        
        // Return 200 if it does exist
        res.status(200).json({ 
            hasPassword: !!room.password, 
            owner: room.owner 
        });
    } catch (error) {
        res.status(500).json({ error: "Server error fetching room details" });
    }
});

app.delete("/api/room/:roomId", async (req, res) => {
  try {
    const { username } = req.query;
    const room = await Room.findOne({ roomId: req.params.roomId });
    
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (room.owner && room.owner !== username) return res.status(403).json({ error: "Forbidden" });

    await Room.findOneAndDelete({ roomId: req.params.roomId });
    if (activeDocs.has(req.params.roomId)) activeDocs.delete(req.params.roomId);
    
    // NEW: Destroy terminal on global deletion
    const ptyProcess = activeTerminals.get(req.params.roomId);
    if (ptyProcess) {
      ptyProcess.kill();
      activeTerminals.delete(req.params.roomId);
    }

    res.status(200).json({ message: "Room deleted globally" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete room" });
  }
});

// We are leaving the old Docker execution endpoint here temporarily in case you still want to use it
app.post("/execute", (req, res) => { /* Docker Logic (Unchanged) */ });

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));