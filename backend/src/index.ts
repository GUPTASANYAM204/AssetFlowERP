import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';

import authRouter from './controllers/auth.controller';
import orgRouter from './controllers/org.controller';
import assetRouter from './controllers/asset.controller';
import allocationRouter from './controllers/allocation.controller';
import bookingRouter from './controllers/booking.controller';
import maintenanceRouter from './controllers/maintenance.controller';
import auditRouter from './controllers/audit.controller';
import reportRouter from './controllers/report.controller';

import { errorHandler } from './middleware/errorHandler';
import { initWebSocketServer } from './websocket/server';

dotenv.config();

const app = express();
const port = process.env.PORT || 5001;

// CORS setup
app.use(cors({
  origin: '*', // For development, allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/org', orgRouter);
app.use('/api/assets', assetRouter);
app.use('/api/allocations', allocationRouter);
app.use('/api/bookings', bookingRouter);
app.use('/api/maintenance', maintenanceRouter);
app.use('/api/audits', auditRouter);
app.use('/api/reports', reportRouter);

// Base test route
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Global Error Handler
app.use(errorHandler);

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server attached to HTTP server
initWebSocketServer(server);

// Start server
server.listen(port, () => {
  console.log(`[AssetFlow Backend] Server running on http://localhost:${port}`);
  console.log(`[AssetFlow WebSocket] Server running on ws://localhost:${port}/ws`);
});
