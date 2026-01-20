import express from 'express';
import cors from 'cors';
// import walletRoutes from './routes/wallet';
import newWalletRoutes from './routes/v1/newWallet';

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'wallet-service' });
});

// Routes
// app.use('/api/wallet', walletRoutes);
app.use('/api/v1/wallet', newWalletRoutes); // New routes for bank accounts, transactions

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
