// src/socket.js
import { io } from 'socket.io-client';

// Dynamically use the live URL in production, or localhost in development
const URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export const socket = io(URL);