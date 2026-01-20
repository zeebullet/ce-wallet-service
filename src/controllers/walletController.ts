import { Request, Response } from 'express';
import { walletService } from '../services/walletService';
import { logger } from '../utils/logger';

export const walletController = {
  // Get wallet
  async getWallet(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;

      if (!userId) {
        res.status(401).json({ 
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required to access wallet information'
        });
        return;
      }

      const wallet = await walletService.getEnhancedWallet(userId);
      res.json({ 
        success: true, 
        data: { wallet } 
      });
    } catch (error: any) {
      logger.error('Get wallet error:', error);
      res.status(500).json({ 
        success: false,
        error: 'WALLET_ERROR',
        message: error.message 
      });
    }
  },

  // Get balance
  async getBalance(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const balance = await walletService.getBalance(userId);
      res.json({ success: true, data: { balance } });
    } catch (error: any) {
      logger.error('Get balance error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Send gift
  async sendGift(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { receiverId, giftType, videoId } = req.body;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      if (!receiverId || !giftType) {
        res.status(400).json({ error: 'Receiver ID and gift type are required' });
        return;
      }

      if (userId === receiverId) {
        res.status(400).json({ error: 'Cannot send gift to yourself' });
        return;
      }

      const result = await walletService.sendGift(userId, receiverId, giftType, videoId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Send gift error:', error);
      res.status(400).json({ error: error.message });
    }
  },

  // Purchase coins
  async purchaseCoins(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { packageId, paymentIntentId } = req.body;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      if (!packageId || !paymentIntentId) {
        res.status(400).json({ error: 'Package ID and payment intent ID are required' });
        return;
      }

      const transaction = await walletService.purchaseCoins(userId, packageId, paymentIntentId);
      res.json({ success: true, data: transaction });
    } catch (error: any) {
      logger.error('Purchase coins error:', error);
      res.status(400).json({ error: error.message });
    }
  },

  // Request withdrawal
  async requestWithdrawal(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { amount, paymentMethod, paymentDetails } = req.body;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      if (!amount || !paymentMethod || !paymentDetails) {
        res.status(400).json({ error: 'Amount, payment method, and payment details are required' });
        return;
      }

      const withdrawal = await walletService.requestWithdrawal(
        userId,
        amount,
        paymentMethod,
        paymentDetails
      );
      res.json({ success: true, data: withdrawal });
    } catch (error: any) {
      logger.error('Request withdrawal error:', error);
      res.status(400).json({ error: error.message });
    }
  },

  // Get transactions
  async getTransactions(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const type = req.query.type as string | undefined;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const result = await walletService.getTransactions(userId, page, limit, type as any);
      res.json({ success: true, ...result });
    } catch (error: any) {
      logger.error('Get transactions error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Get gifts received
  async getGiftsReceived(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const videoId = req.query.videoId as string | undefined;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const result = await walletService.getGiftsReceived(userId, videoId, page, limit);
      res.json({ success: true, ...result });
    } catch (error: any) {
      logger.error('Get gifts received error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Get withdrawals
  async getWithdrawals(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const result = await walletService.getWithdrawals(userId, page, limit);
      res.json({ success: true, ...result });
    } catch (error: any) {
      logger.error('Get withdrawals error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Get coin packages
  async getCoinPackages(req: Request, res: Response) {
    try {
      const packages = walletService.getCoinPackages();
      res.json({ success: true, data: packages });
    } catch (error: any) {
      logger.error('Get coin packages error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Get gift types
  async getGiftTypes(req: Request, res: Response) {
    try {
      const giftTypes = walletService.getGiftTypes();
      res.json({ success: true, data: giftTypes });
    } catch (error: any) {
      logger.error('Get gift types error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Get transaction by ID
  async getTransactionById(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { transactionId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const transaction = await walletService.getTransactionById(transactionId, userId);
      
      if (!transaction) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      res.json({ success: true, data: transaction });
    } catch (error: any) {
      logger.error('Get transaction by ID error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Get sent gifts
  async getGiftsSent(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const result = await walletService.getSentGifts(userId, page, limit);
      res.json({ success: true, ...result });
    } catch (error: any) {
      logger.error('Get gifts sent error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Get referral stats
  async getReferralStats(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const stats = await walletService.getReferralStats(userId);
      res.json({ success: true, data: stats });
    } catch (error: any) {
      logger.error('Get referral stats error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Apply referral code
  async applyReferralCode(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { referralCode } = req.body;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      if (!referralCode) {
        res.status(400).json({ error: 'Referral code is required' });
        return;
      }

      await walletService.applyReferralCode(userId, referralCode);
      res.json({ success: true, message: 'Referral code applied successfully' });
    } catch (error: any) {
      logger.error('Apply referral code error:', error);
      res.status(400).json({ error: error.message });
    }
  },

  // Get withdrawal by ID
  async getWithdrawalById(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { withdrawalId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const withdrawal = await walletService.getWithdrawalById(withdrawalId, userId);
      
      if (!withdrawal) {
        res.status(404).json({ error: 'Withdrawal not found' });
        return;
      }

      res.json({ success: true, data: withdrawal });
    } catch (error: any) {
      logger.error('Get withdrawal by ID error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Get gifter leaderboard
  async getGifterLeaderboard(req: Request, res: Response) {
    try {
      const period = (req.query.period as 'daily' | 'weekly' | 'monthly' | 'all') || 'weekly';
      const limit = parseInt(req.query.limit as string) || 10;

      const leaderboard = await walletService.getGifterLeaderboard(period, limit);
      res.json({ success: true, data: leaderboard });
    } catch (error: any) {
      logger.error('Get gifter leaderboard error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Get earner leaderboard
  async getEarnerLeaderboard(req: Request, res: Response) {
    try {
      const period = (req.query.period as 'daily' | 'weekly' | 'monthly' | 'all') || 'weekly';
      const limit = parseInt(req.query.limit as string) || 10;

      const leaderboard = await walletService.getEarnerLeaderboard(period, limit);
      res.json({ success: true, data: leaderboard });
    } catch (error: any) {
      logger.error('Get earner leaderboard error:', error);
      res.status(500).json({ error: error.message });
    }
  },
};
