import { Router } from 'express';
import { walletController } from '../../controllers/walletController';

const router = Router();

// Wallet
router.get('/', walletController.getWallet);
router.get('/balance', walletController.getBalance);

// Transactions
router.get('/transactions', walletController.getTransactions);
router.get('/transactions/:transactionId', walletController.getTransactionById);

// Gifts
router.post('/gift', walletController.sendGift);
router.get('/gifts', walletController.getGiftsReceived);
router.get('/gifts/sent', walletController.getGiftsSent);
router.get('/gift-types', walletController.getGiftTypes);

// Purchases
router.post('/purchase', walletController.purchaseCoins);
router.get('/packages', walletController.getCoinPackages);

// Withdrawals
router.post('/withdraw', walletController.requestWithdrawal);
router.get('/withdrawals', walletController.getWithdrawals);
router.get('/withdrawals/:withdrawalId', walletController.getWithdrawalById);

// Referrals
router.get('/referral', walletController.getReferralStats);
router.post('/referral/apply', walletController.applyReferralCode);

// Leaderboards
router.get('/leaderboard/gifters', walletController.getGifterLeaderboard);
router.get('/leaderboard/earners', walletController.getEarnerLeaderboard);

export default router;
