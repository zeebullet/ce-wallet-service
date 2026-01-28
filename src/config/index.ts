import dotenv from 'dotenv';
import path from 'path';

// Load .env from root directory
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3008', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'ce_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres123',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret',
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },
  
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },
  
  withdrawal: {
    minAmount: parseInt(process.env.MIN_WITHDRAWAL_AMOUNT || '1000', 10),
    feePercent: parseFloat(process.env.WITHDRAWAL_FEE_PERCENT || '5'),
  },

  gcp: {
    useDefaultCredentials: process.env.GCP_USE_DEFAULT_CREDENTIALS === 'true',
    bucket: process.env.GCS_BUCKET || 'ce-videos-creatoreconomy-479409',
    keyFile: path.join(process.cwd(), 'keys/gcs-service-account.json'),
  },
};

