import { createServer } from 'node:http';
import app from './app.js';
import { config } from './config/env.js';
import { connectDB } from './config/db.js';

async function startServer() {
  await connectDB();

  const server = createServer(app);
  // Socket.io will attach to this HTTP server here.
  server.listen(config.port, () => {
    console.info(`Server listening on port ${config.port}`);
  });
}

startServer().catch((error) => {
  console.error('Server startup failed:', error.message);
  process.exit(1);
});
