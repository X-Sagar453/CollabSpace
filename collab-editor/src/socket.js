// src/socket.js
import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export const socket = io(URL, {
  auth: (cb) => {
    // Send the token on every socket connection/reconnection
    cb({ token: localStorage.getItem('token') });
  }
}); 