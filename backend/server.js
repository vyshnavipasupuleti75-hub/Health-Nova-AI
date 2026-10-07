import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import { startNotificationScheduler } from './services/notificationScheduler.js';
import errorHandler from './middleware/errorHandler.js';

const backendDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(backendDirectory, '.env') });

if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
  console.error('Missing MONGO_URI or JWT_SECRET in backend/.env');
  process.exit(1);
}

const app = express();
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5175';
const allowedOrigins = new Set([clientUrl]);
try {
  const clientOrigin = new URL(clientUrl);
  if (clientOrigin.hostname === 'localhost') allowedOrigins.add(`${clientOrigin.protocol}//127.0.0.1${clientOrigin.port ? `:${clientOrigin.port}` : ''}`);
  if (clientOrigin.hostname === '127.0.0.1') allowedOrigins.add(`${clientOrigin.protocol}//localhost${clientOrigin.port ? `:${clientOrigin.port}` : ''}`);
} catch {
  console.error('CLIENT_URL must be a valid origin, for example http://localhost:5175');
  process.exit(1);
}
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(path.join(backendDirectory, 'uploads')));
app.get('/api/health', (req, res) => res.json({ status: 'ok', name: 'Health-Nova-AI API' }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use(errorHandler);

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Health-Nova-AI API running on port ${port}`));
connectDB();
startNotificationScheduler();
