// src/socket.js
import { io } from 'socket.io-client';

// The URL should point to your Express server's port
const URL = process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:5000';

export const socket = io(URL);