import { createServer } from 'node:http';
import app from './app.js';
import { config } from './config/env.js';
import { connectDB } from './config/db.js';
import { initSockets } from './sockets/chat.js';

async function startServer() {
  await connectDB();

  const server = createServer(app);
  initSockets(server);
  server.listen(config.port, () => {
    console.info(`Server listening on port ${config.port}`);
  });
}

startServer().catch((error) => {
  console.error('Server startup failed:', error.message);
  process.exit(1);
});
