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
    origin: "http://localhost:5173",
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
        // FIX: The first person to join/create the room is stamped as the owner
        room = new Room({ roomId, password: password || null, owner: username, files: [], chatMessages: [] });
        await room.save();
      }

      socket.join(roomId);
      
      const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500'];
      const userColor = colors[Math.floor(Math.random() * colors.length)];

      const newUser = { 
        id: socket.id, 
        username: username || 'Anonymous', 
        color: userColor 
      };

      if (!roomUsers.has(roomId)) {
        roomUsers.set(roomId, []);
      }
      roomUsers.get(roomId).push(newUser);

      if (room.files && room.files.length > 0) {
        socket.emit("file-tree-sync", room.files);
      }

      if (room.chatMessages && room.chatMessages.length > 0) {
        socket.emit("chat-history", room.chatMessages);
      }

      if (!activeDocs.has(roomId)) {
        const doc = new Y.Doc();
        if (room.ydocState) {
          try {
            Y.applyUpdate(doc, new Uint8Array(room.ydocState));
          } catch(e) {
            console.error("Failed to parse saved code:", e);
          }
        }
        activeDocs.set(roomId, doc);
      }
      
      io.to(roomId).emit("room-users-update", roomUsers.get(roomId));

    } catch (error) {
      console.error("Error joining room:", error);
    }
  });

  socket.on("request-initial-code", (roomId) => {
    const doc = activeDocs.get(roomId);
    if (doc) {
      const stateVector = Y.encodeStateAsUpdate(doc);
      socket.emit("code-update", stateVector);
    }
  });

  socket.on("request-file-tree", async (roomId) => {
    try {
      const room = await Room.findOne({ roomId });
      if (room && room.files && room.files.length > 0) {
        socket.emit("file-tree-sync", room.files);
      }
    } catch (error) {
      console.error("Error fetching file tree:", error);
    }
  });

  socket.on("request-room-users", (roomId) => {
    const users = roomUsers.get(roomId) || [];
    socket.emit("room-users-update", users);
  });

  socket.on("file-tree-update", async ({ roomId, files }) => {
    try {
      await Room.findOneAndUpdate(
        { roomId }, 
        { files, lastUpdated: Date.now() }, 
        { upsert: true, returnDocument: 'after' }
      );
      socket.to(roomId).emit("file-tree-sync", files);
    } catch (error) {
      console.error("Error saving file tree to DB:", error);
    }
  });

  socket.on("code-update", ({ roomId, update }) => {
    socket.to(roomId).emit("code-update", update); 
    
    const doc = activeDocs.get(roomId);
    if (doc) {
      Y.applyUpdate(doc, new Uint8Array(update));
    }
  });

  socket.on("send-message", async ({ roomId, message }) => {
    const usersInRoom = roomUsers.get(roomId) || [];
    const user = usersInRoom.find(u => u.id === socket.id);
    if (user) message.sender = user.username; 

    io.to(roomId).emit("receive-message", message);
    
    try {
      await Room.findOneAndUpdate(
        { roomId },
        { $push: { chatMessages: message }, lastUpdated: Date.now() }
      );
    } catch (error) {
      console.error("Error saving chat message:", error);
    }
  });

  socket.on("ping", (callback) => {
    if (typeof callback === "function") callback();
  });

  socket.on("disconnecting", async () => {
    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) {
        let users = roomUsers.get(roomId) || [];
        users = users.filter(u => u.id !== socket.id);
        
        if (users.length === 0) {
          const doc = activeDocs.get(roomId);
          if (doc) {
            try {
              const state = Y.encodeStateAsUpdate(doc);
              await Room.findOneAndUpdate(
                { roomId },
                { ydocState: Buffer.from(state), lastUpdated: Date.now() },
                { upsert: true }
              );
              activeDocs.delete(roomId); 
              roomUsers.delete(roomId);
            } catch (err) {
              console.error("Error saving code to DB:", err);
            }
          }
        } else {
          roomUsers.set(roomId, users);
          io.to(roomId).emit("room-users-update", users);
        }
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const normalizedEmail = email.toLowerCase();
    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail) return res.status(400).json({ error: "An account with this email already exists." });
    const existingUsername = await User.findOne({ username });
    if (existingUsername) return res.status(400).json({ error: "That username is already taken." });
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = new User({ username, email: normalizedEmail, password: hashedPassword });
    await newUser.save();
    const token = jwt.sign({ id: newUser._id, username: newUser.username }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, username: newUser.username });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(400).json({ error: "The user does not exist." });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid password." });
    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
    res.status(200).json({ token, username: user.username });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/room/:roomId", async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    if (room) {
      res.status(200).json({ exists: true, owner: room.owner });
    } else {
      res.status(404).json({ exists: false });
    }
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// FIX: Protected delete route. Only allows the owner to globally destroy the room.
app.delete("/api/room/:roomId", async (req, res) => {
  try {
    const { username } = req.query;
    const room = await Room.findOne({ roomId: req.params.roomId });
    
    if (!room) return res.status(404).json({ error: "Room not found" });

    if (room.owner && room.owner !== username) {
      return res.status(403).json({ error: "Only the room owner can permanently delete this workspace." });
    }

    await Room.findOneAndDelete({ roomId: req.params.roomId });
    if (activeDocs.has(req.params.roomId)) activeDocs.delete(req.params.roomId);
    res.status(200).json({ message: "Room deleted globally" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete room" });
  }
});

app.post("/execute", (req, res) => {
  try {
    const { code, filename } = req.body;
    if (!code) return res.status(400).json({ output: "No code provided." });
    const tempDir = path.join(__dirname, "temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    const isPython = filename && filename.toLowerCase().endsWith('.py');
    const ext = isPython ? 'py' : 'js';
    const uniqueFileName = `${uuidv4()}.${ext}`;
    const filePath = path.join(tempDir, uniqueFileName);
    fs.writeFileSync(filePath, code);
    const dockerVolumePath = tempDir.replace(/\\/g, '/');
    let command = isPython 
      ? `docker run --rm --network none --memory="128m" --cpus="0.5" -v "${dockerVolumePath}:/app" python:3.10-alpine python /app/${uniqueFileName}`
      : `docker run --rm --network none --memory="128m" --cpus="0.5" -v "${dockerVolumePath}:/app" node:18-alpine node /app/${uniqueFileName}`;
    
    exec(command, { timeout: 5000 }, (error, stdout, stderr) => {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      if (error) {
        if (error.killed) return res.status(408).json({ output: "Error: Execution timed out." });
        return res.status(500).json({ output: stderr || error.message });
      }
      res.json({ output: stdout });
    });
  } catch (err) {
    res.status(500).json({ output: `Backend Error: ${err.message}` });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));