// collab-server/models/Room.js
const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  password: { type: String, default: null },
  owner: { type: String }, // NEW: Tracks who created the room
  files: { type: Array, default: [] },
  ydocState: { type: Buffer }, 
  chatMessages: { type: Array, default: [] },
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Room', roomSchema);