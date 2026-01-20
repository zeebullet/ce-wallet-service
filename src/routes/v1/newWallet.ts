import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as bankAccountService from '../../services/bankAccountService';
import * as transactionService from '../../services/transactionService';
import * as newWalletService from '../../services/newWalletService';
import * as brandWalletService from '../../services/brandWalletService';
import * as brandRechargeService from '../../services/brandRechargeService';
import { logger } from '../../utils/logger';
import { Response } from 'express';
import { AuthenticatedRequest, extractUser, requireAuth, requireAdmin } from '../../middleware/auth';

const router = Router();

// Apply extractUser middleware to all routes
router.use(extractUser);

// ============ WALLET ROUTES ============

/**
 * GET /api/wallet/balance
 * Get wallet balance
 */
router.get('/balance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await newWalletService.getBalance(userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Error getting balance', { error: error.message });
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/wallet/summary
 * Get wallet summary with stats
 */
router.get('/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await newWalletService.getWalletSummary(userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Error getting wallet summary', { error: error.message });
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/wallet/leaderboard
 * Get earnings leaderboard
 */
router.get('/leaderboard', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const period = req.query.period as 'all_time' | 'monthly' | 'weekly' || 'all_time';
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await newWalletService.getEarningsLeaderboard(period, limit);
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Error getting leaderboard', { error: error.message });
    res.status(400).json({ success: false, message: error.message });
  }
});

// ============ BRAND WALLET ROUTES ============

/**
 * GET /api/wallet/brand
 * Get brand wallet for the authenticated user (creates if not exists)
 * This is the main endpoint for brands to access their wallet
 */
router.get('/brand', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await brandWalletService.getOrCreateBrandWallet(userId);
    res.json({ 
      success: true, 
      data: result 
    });
  } catch (error: any) {
    logger.error('Error getting brand wallet', { error: error.message, userId: req.user?.id });
    
    // Handle specific errors
    if (error.message.includes('No brand linked')) {
      res.status(404).json({ 
        success: false, 
        error: 'BRAND_NOT_FOUND',
        message: error.message 
      });
      return;
    }
    
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/wallet/brand/transactions
 * Get brand wallet transactions
 */
router.get('/brand/transactions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // First get the brand wallet to get brand_id
    const walletData = await brandWalletService.getOrCreateBrandWallet(userId);
    const brandId = walletData.wallet.brand_id;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const type = req.query.type as string | undefined;
    const currency_type = req.query.currency_type as 'token' | 'escrow' | undefined;
    const status = req.query.status as string | undefined;

    const result = await brandWalletService.getBrandTransactions(brandId, {
      page,
      limit,
      type,
      currency_type,
      status,
    });

    res.json({ 
      success: true, 
      data: result 
    });
  } catch (error: any) {
    logger.error('Error getting brand transactions', { error: error.message, userId: req.user?.id });
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/wallet/brand/packages
 * Get available brand packages
 */
router.get('/brand/packages', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const packages = await brandWalletService.getAvailableBrandPackages();
    res.json({ 
      success: true, 
      data: { packages } 
    });
  } catch (error: any) {
    logger.error('Error getting brand packages', { error: error.message });
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/wallet/brand/check-tokens
 * Check if user has enough tokens for an action
 */
router.get('/brand/check-tokens', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const tokenCosts = await brandWalletService.getTokenCosts(userId);
    const checkTokens = await brandWalletService.hasEnoughTokens(userId, tokenCosts);

    res.json({ 
      success: true, 
      data: { 
        has_enough_tokens_for_search: checkTokens.has_enough_tokens_for_search,
        required_tokens_for_search: checkTokens.required_tokens_for_search || 0,
        has_enough_tokens_for_campaign: checkTokens.has_enough_tokens_for_campaign,
        required_tokens_for_campaign: checkTokens.required_tokens_for_campaign || 0,
        token_costs: tokenCosts,
      } 
    });
  } catch (error: any) {
    logger.error('Error checking tokens', { error: error.message, userId: req.user?.id });
    res.status(400).json({ success: false, message: error.message });
  }
});

// ============ BRAND RECHARGE ROUTES ============

/**
 * POST /api/wallet/brand/recharge/initiate
 * Initiate wallet recharge - Create Razorpay order
 */
router.post(
  '/brand/recharge/initiate',
  requireAuth,
  body('package_id').isUUID().withMessage('Valid package ID required'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { package_id } = req.body;

      // Get brand linked to this user
      const walletData = await brandWalletService.getOrCreateBrandWallet(userId);
      const brandId = walletData.wallet.brand_id;

      const result = await brandRechargeService.initiateRecharge({
        package_id,
        brand_id: brandId,
        user_id: userId,
      });

      res.json({ 
        success: true, 
        data: result 
      });
    } catch (error: any) {
      logger.error('Error initiating recharge', { error: error.message, userId: req.user?.id });
      
      if (error.message.includes('Package not found')) {
        return res.status(404).json({ 
          success: false, 
          error: 'PACKAGE_NOT_FOUND',
          message: error.message 
        });
      }
      
      if (error.message.includes('free package')) {
        return res.status(400).json({ 
          success: false, 
          error: 'FREE_PACKAGE',
          message: error.message 
        });
      }
      
      res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * POST /api/wallet/brand/recharge/verify
 * Verify payment and credit tokens
 */
router.post(
  '/brand/recharge/verify',
  requireAuth,
  body('razorpay_order_id').notEmpty().withMessage('Razorpay order ID required'),
  body('razorpay_payment_id').notEmpty().withMessage('Razorpay payment ID required'),
  body('razorpay_signature').notEmpty().withMessage('Razorpay signature required'),
  body('transaction_id').isUUID().withMessage('Valid transaction ID required'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, transaction_id } = req.body;

      const result = await brandRechargeService.verifyRecharge({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        transaction_id,
      });

      res.json({ 
        success: true, 
        data: result 
      });
    } catch (error: any) {
      logger.error('Error verifying recharge', { 
        error: error.message, 
        userId: req.user?.id,
        razorpay_order_id: req.body.razorpay_order_id,
      });
      
      if (error.message.includes('verification failed')) {
        return res.status(400).json({ 
          success: false, 
          error: 'PAYMENT_VERIFICATION_FAILED',
          message: error.message 
        });
      }
      
      if (error.message.includes('already processed')) {
        return res.status(409).json({ 
          success: false, 
          error: 'ALREADY_PROCESSED',
          message: error.message 
        });
      }
      
      res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * POST /api/wallet/brand/recharge/webhook
 * Handle Razorpay webhook events
 */
router.post('/brand/recharge/webhook', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const event = req.body.event;
    const payload = req.body.payload;

    const result = await brandRechargeService.handleWebhook(event, payload, signature);

    res.json({ 
      success: true, 
      data: result 
    });
  } catch (error: any) {
    logger.error('Error handling webhook', { error: error.message });
    // Always return 200 to Razorpay to prevent retries for invalid payloads
    res.json({ success: false, message: error.message });
  }
});

/**
 * GET /api/wallet/brand/recharge/history
 * Get recharge history for the brand
 */
router.get('/brand/recharge/history', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    // Get brand linked to this user
    const walletData = await brandWalletService.getOrCreateBrandWallet(userId);
    const brandId = walletData.wallet.brand_id;

    const result = await brandRechargeService.getRechargeHistory(brandId, page, limit);

    res.json({ 
      success: true, 
      data: result 
    });
  } catch (error: any) {
    logger.error('Error getting recharge history', { error: error.message, userId: req.user?.id });
    res.status(400).json({ success: false, message: error.message });
  }
});

// ============ BANK ACCOUNT ROUTES ============

/**
 * POST /api/bank-accounts
 * Add a bank account
 */
router.post(
  '/bank-accounts',
  requireAuth,
  body('account_holder_name').notEmpty().withMessage('Account holder name required'),
  body('account_number').notEmpty().withMessage('Account number required'),
  body('ifsc_code').notEmpty().withMessage('IFSC code required'),
  body('bank_name').notEmpty().withMessage('Bank name required'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;

      const result = await bankAccountService.addBankAccount(userId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Error adding bank account', { error: error.message });
      res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * GET /api/bank-accounts
 * Get user's bank accounts
 */
router.get('/bank-accounts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await bankAccountService.getBankAccounts(userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Error getting bank accounts', { error: error.message });
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/bank-accounts/:id/primary
 * Set primary bank account
 */
router.put(
  '/bank-accounts/:id/primary',
  requireAuth,
  param('id').isUUID().withMessage('Valid account ID required'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;

      const { id } = req.params;
      await bankAccountService.setPrimaryAccount(userId, id);
      res.json({ success: true, message: 'Primary account updated' });
    } catch (error: any) {
      logger.error('Error setting primary account', { error: error.message });
      res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * DELETE /api/bank-accounts/:id
 * Delete bank account
 */
router.delete(
  '/bank-accounts/:id',
  requireAuth,
  param('id').isUUID().withMessage('Valid account ID required'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;

      const { id } = req.params;
      await bankAccountService.deleteBankAccount(userId, id);
      res.json({ success: true, message: 'Bank account deleted' });
    } catch (error: any) {
      logger.error('Error deleting bank account', { error: error.message });
      res.status(400).json({ success: false, message: error.message });
    }
  }
);

// ============ TRANSACTION ROUTES ============

/**
 * GET /api/transactions
 * Get user's transactions
 */
router.get(
  '/transactions',
  requireAuth,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const transaction_type = req.query.transaction_type as string;
      const status = req.query.status as string;

      const result = await transactionService.getUserTransactions(userId, page, limit, {
        transaction_type,
        status
      });
      res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Error getting transactions', { error: error.message });
      res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * GET /api/transactions/summary
 * Get transaction summary
 */
router.get('/transactions/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await transactionService.getTransactionSummary(userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Error getting transaction summary', { error: error.message });
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/transactions/:id
 * Get transaction by ID
 */
router.get(
  '/transactions/:id',
  param('id').isUUID().withMessage('Valid transaction ID required'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const result = await transactionService.getTransactionById(id);
      if (!result) {
        return res.status(404).json({ success: false, message: 'Transaction not found' });
      }
      res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Error getting transaction', { error: error.message });
      res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * POST /api/withdrawals
 * Request withdrawal
 */
router.post(
  '/withdrawals',
  requireAuth,
  body('amount').isFloat({ min: 100 }).withMessage('Minimum withdrawal is ₹100'),
  body('bank_account_id').isUUID().withMessage('Valid bank account ID required'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;

      const { amount, bank_account_id } = req.body;
      const result = await transactionService.requestWithdrawal(userId, amount, bank_account_id);
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Error requesting withdrawal', { error: error.message });
      res.status(400).json({ success: false, message: error.message });
    }
  }
);

// ============ ADMIN ROUTES ============

/**
 * GET /api/admin/bank-accounts/pending
 * Get pending bank account verifications
 */
router.get('/admin/bank-accounts/pending', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await bankAccountService.getPendingVerifications(page, limit);
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Error getting pending verifications', { error: error.message });
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/bank-accounts/:id/verify
 * Verify bank account
 */
router.post(
  '/admin/bank-accounts/:id/verify',
  requireAdmin,
  param('id').isUUID().withMessage('Valid account ID required'),
  body('verified').isBoolean().withMessage('Verified status required'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { verified, notes } = req.body;

      const result = await bankAccountService.verifyBankAccount(id, verified, notes);
      res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Error verifying bank account', { error: error.message });
      res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * GET /api/admin/withdrawals/pending
 * Get pending withdrawals
 */
router.get('/admin/withdrawals/pending', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await transactionService.getPendingWithdrawals(page, limit);
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Error getting pending withdrawals', { error: error.message });
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/withdrawals/:id/process
 * Process withdrawal
 */
router.post(
  '/admin/withdrawals/:id/process',
  requireAdmin,
  param('id').isUUID().withMessage('Valid transaction ID required'),
  body('success').isBoolean().withMessage('Success status required'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { success, external_transaction_id, failure_reason } = req.body;

      const result = await transactionService.processWithdrawal(
        id,
        success,
        external_transaction_id,
        failure_reason
      );
      res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Error processing withdrawal', { error: error.message });
      res.status(400).json({ success: false, message: error.message });
    }
  }
);

export default router;
