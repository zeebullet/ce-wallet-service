import app from './app';
import { config } from './config';
import { logger } from './utils/logger';

const startServer = async () => {
  try {
    app.listen(config.port, () => {
      logger.info(`💰 Wallet Service running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    logger.error('Failed to start Wallet Service:', error);
    process.exit(1);
  }
};

startServer();
