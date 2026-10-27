import { io } from 'socket.io-client';
import api from './axios.js';

export function createSocket() {
  return io(import.meta.env.VITE_SOCKET_URL, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    auth: (callback) => {
      api.get('/auth/socket-token')
        .then((response) => callback({ token: response.data.token }))
        .catch(() => callback({}));
    },
  });
}
