// Pre-load sharp to potentially resolve runtime loading conflicts
console.log('Pre-loading sharp...');
try {
  require('sharp');
  console.log('Sharp pre-loaded successfully.');
} catch (err) {
  console.error('ERROR pre-loading sharp:', err);
  // Exit if sharp cannot be loaded even here
  process.exit(1); 
}

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Import routes
import routes from './routes';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Prisma client
export const prisma = new PrismaClient();

// Middlewares
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'API is running' });
});

// Apply routes
app.use('/api', routes);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  console.log('Shutting down server...');
  process.exit(0);
}); 