import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './api/router';
import { requestLogger } from './api/middleware/logger';
import { errorHandler } from './api/middleware/errorHandler';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Security & parsing middlewares
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(requestLogger);

  // Mount API Layer
  app.use('/api', apiRouter);

  // Mount Vite or static assets
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use((req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // Global Error Handler
  app.use(errorHandler);

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ScaleKitchen Server] Running at http://0.0.0.0:${PORT}`);
    console.log(`[ScaleKitchen Server] Architecture: Full-Stack API + Vite Middleware`);
    console.log(`[ScaleKitchen Server] API Endpoints ready at /api/*`);
  });

  return server;
}

startServer().catch((err) => {
  console.error('[Server Start Error]', err);
  process.exit(1);
});
