import db from '../db';
import { logger } from '../utils/logger';
import { config } from '../config';

// Enhanced Types for comprehensive wallet information
interface EnhancedWallet {
  id: string;
  user_id: string;
  balance: {
    available: number;
    pending: number;
    total: number;
    currency: string;
  };
  earnings_summary: {
    total_lifetime: number;
    this_month: number;
    last_month: number;
    this_year: number;
    campaigns_completed: number;
    avg_per_campaign: number;
  };
  pending_payments: PendingPayment[];
  recent_earnings: RecentEarning[];
  payment_methods: PaymentMethod[];
  tax_info: TaxInfo;
  wallet_settings: WalletSettings;
  created_at: Date;
  updated_at: Date;
}

interface PendingPayment {
  id: string;
  campaign_id: string;
  campaign_title: string;
  brand_name: string;
  amount: number;
  status: string;
  estimated_arrival: string;
  payment_method: string;
}

interface RecentEarning {
  id: string;
  campaign_id: string;
  campaign_title: string;
  brand_name: string;
  amount: number;
  bonus: number;
  total: number;
  earned_date: string;
  payment_status: string;
}

interface PaymentMethod {
  id: string;
  type: string;
  name: string;
  account_last_4?: string;
  email?: string;
  is_primary: boolean;
  is_verified: boolean;
  added_at: string;
}

interface TaxInfo {
  tax_year: number;
  total_earnings: number;
  tax_documents_available: boolean;
  requires_1099: boolean;
  estimated_tax_withholding: number;
}

interface WalletSettings {
  auto_withdraw: boolean;
  minimum_withdrawal: number;
  preferred_payment_method: string;
  notification_preferences: {
    payment_received: boolean;
    withdrawal_processed: boolean;
    low_balance_alert: boolean;
    monthly_statement: boolean;
  };
}

// Types
interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  pending_balance: number;
  total_earnings: number;
  total_earned: number;
  total_withdrawals: number;
  total_spent: number;
  currency: string;
  last_transaction_at?: Date;
  created_at: Date;
  updated_at: Date;
}

interface Transaction {
  id: string;
  wallet_id: string;
  type: TransactionType;
  amount: number;
  status: string;
  reference_id?: string;
  description?: string;
  metadata?: any;
  created_at: Date;
}

type TransactionType = 'credit' | 'debit' | 'withdrawal' | 'refund' | 'commission' | 'gift_sent' | 'gift_received' | 'purchase' | 'earning';

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Gift types with coin values
export const GIFT_TYPES = {
  heart: { name: 'Heart', coins: 1, icon: '❤️' },
  star: { name: 'Star', coins: 5, icon: '⭐' },
  fire: { name: 'Fire', coins: 10, icon: '🔥' },
  diamond: { name: 'Diamond', coins: 50, icon: '💎' },
  crown: { name: 'Crown', coins: 100, icon: '👑' },
  rocket: { name: 'Rocket', coins: 500, icon: '🚀' },
  unicorn: { name: 'Unicorn', coins: 1000, icon: '🦄' },
};

// Coin packages for purchase
export const COIN_PACKAGES = [
  { id: 'pack_100', coins: 100, price: 0.99, bonus: 0 },
  { id: 'pack_500', coins: 500, price: 4.99, bonus: 50 },
  { id: 'pack_1000', coins: 1000, price: 9.99, bonus: 150 },
  { id: 'pack_5000', coins: 5000, price: 49.99, bonus: 1000 },
  { id: 'pack_10000', coins: 10000, price: 99.99, bonus: 2500 },
];

class WalletService {
  // Get enhanced wallet with comprehensive information
  async getEnhancedWallet(userId: string): Promise<EnhancedWallet> {
    const wallet = await this.getWallet(userId);
    
    // Get earnings data
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    
    // Calculate earnings summary
    const earningsSummary = await this.calculateEarningsSummary(userId, currentYear, currentMonth);
    
    // Get pending payments
    const pendingPayments = await this.getPendingPayments(userId);
    
    // Get recent earnings
    const recentEarnings = await this.getRecentEarnings(userId);
    
    // Get payment methods
    const paymentMethods = await this.getPaymentMethods(userId);
    
    // Get tax info
    const taxInfo = await this.getTaxInfo(userId, currentYear);
    
    // Get wallet settings
    const walletSettings = await this.getWalletSettings(userId);
    
    return {
      id: wallet.id,
      user_id: wallet.user_id,
      balance: {
        available: wallet.balance,
        pending: wallet.pending_balance || 0,
        total: wallet.balance + (wallet.pending_balance || 0),
        currency: wallet.currency || 'USD'
      },
      earnings_summary: earningsSummary,
      pending_payments: pendingPayments,
      recent_earnings: recentEarnings,
      payment_methods: paymentMethods,
      tax_info: taxInfo,
      wallet_settings: walletSettings,
      created_at: wallet.created_at,
      updated_at: wallet.updated_at
    };
  }

  // Calculate earnings summary
  async calculateEarningsSummary(userId: string, currentYear: number, currentMonth: number) {
    // Mock data for now - in production, this would query transactions table
    const totalLifetime = 18750.25;
    const campaignsCompleted = 24;
    
    return {
      total_lifetime: totalLifetime,
      this_month: 3250.75,
      last_month: 2890.50,
      this_year: 15420.25,
      campaigns_completed: campaignsCompleted,
      avg_per_campaign: Math.round((totalLifetime / campaignsCompleted) * 100) / 100
    };
  }

  // Get pending payments
  async getPendingPayments(userId: string): Promise<PendingPayment[]> {
    // Mock data - in production, query from campaigns/applications tables
    return [
      {
        id: 'payment_pending001',
        campaign_id: 'campaign_abc123',
        campaign_title: 'Holiday Tech Gift Guide 2025',
        brand_name: 'TechCorp Solutions',
        amount: 800.00,
        status: 'processing',
        estimated_arrival: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        payment_method: 'bank_transfer'
      }
    ];
  }

  // Get recent earnings
  async getRecentEarnings(userId: string): Promise<RecentEarning[]> {
    // Mock data - in production, query from transactions table
    return [
      {
        id: 'earning_001',
        campaign_id: 'campaign_completed001',
        campaign_title: 'Fitness New Year Challenge',
        brand_name: 'FitLife Pro',
        amount: 650.00,
        bonus: 50.00,
        total: 700.00,
        earned_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        payment_status: 'completed'
      }
    ];
  }

  // Get payment methods
  async getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    // Mock data - in production, query from bank_accounts table
    return [
      {
        id: 'bank_001',
        type: 'bank_account',
        name: 'Wells Fargo Checking',
        account_last_4: '1234',
        is_primary: true,
        is_verified: true,
        added_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
  }

  // Get tax info
  async getTaxInfo(userId: string, taxYear: number): Promise<TaxInfo> {
    return {
      tax_year: taxYear,
      total_earnings: 15420.25,
      tax_documents_available: true,
      requires_1099: true,
      estimated_tax_withholding: 2313.04
    };
  }

  // Get wallet settings
  async getWalletSettings(userId: string): Promise<WalletSettings> {
    return {
      auto_withdraw: false,
      minimum_withdrawal: 50.00,
      preferred_payment_method: 'bank_001',
      notification_preferences: {
        payment_received: true,
        withdrawal_processed: true,
        low_balance_alert: false,
        monthly_statement: true
      }
    };
  }

  // Get or create wallet
  async getWallet(userId: string): Promise<Wallet> {
    let wallet = await db('ce_wallets').where('user_id', userId).first();

    if (!wallet) {
      [wallet] = await db('ce_wallets')
        .insert({
          user_id: userId,
          balance: 0,
          total_earned: 0,
          total_spent: 0,
          total_withdrawn: 0,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');

      logger.info(`Wallet created for user ${userId}`);
    }

    return wallet;
  }

  // Get balance
  async getBalance(userId: string): Promise<number> {
    const wallet = await this.getWallet(userId);
    return wallet.balance;
  }

  // Add coins (from purchase or gift received)
  async addCoins(
    userId: string,
    amount: number,
    type: TransactionType,
    description: string,
    referenceId?: string
  ): Promise<Transaction> {
    const wallet = await this.getWallet(userId);

    await db.transaction(async (trx: any) => {
      // Update wallet
      await trx('wallets')
        .where('user_id', userId)
        .update({
          balance: wallet.balance + amount,
          total_earned: wallet.total_earned + amount,
          updated_at: new Date(),
        });

      // Create transaction record
      await trx('transactions').insert({
        user_id: userId,
        type,
        amount,
        balance_after: wallet.balance + amount,
        description,
        reference_id: referenceId,
        status: 'completed',
        created_at: new Date(),
      });
    });

    const [transaction] = await db('ce_transactions')
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .limit(1);

    logger.info(`Added ${amount} coins to user ${userId}: ${description}`);
    return transaction;
  }

  // Deduct coins (for sending gift or spending)
  async deductCoins(
    userId: string,
    amount: number,
    type: TransactionType,
    description: string,
    referenceId?: string
  ): Promise<Transaction> {
    const wallet = await this.getWallet(userId);

    if (wallet.balance < amount) {
      throw new Error('Insufficient balance');
    }

    await db.transaction(async (trx: any) => {
      await trx('wallets')
        .where('user_id', userId)
        .update({
          balance: wallet.balance - amount,
          total_spent: wallet.total_spent + amount,
          updated_at: new Date(),
        });

      await trx('transactions').insert({
        user_id: userId,
        type,
        amount: -amount,
        balance_after: wallet.balance - amount,
        description,
        reference_id: referenceId,
        status: 'completed',
        created_at: new Date(),
      });
    });

    const [transaction] = await db('ce_transactions')
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .limit(1);

    logger.info(`Deducted ${amount} coins from user ${userId}: ${description}`);
    return transaction;
  }

  // Send gift
  async sendGift(
    senderId: string,
    receiverId: string,
    giftType: keyof typeof GIFT_TYPES,
    videoId?: string
  ): Promise<{ senderTransaction: Transaction; receiverTransaction: Transaction }> {
    const gift = GIFT_TYPES[giftType];
    if (!gift) {
      throw new Error('Invalid gift type');
    }

    // Create gift record
    const [giftRecord] = await db('ce_gifts')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        gift_type: giftType,
        coins: gift.coins,
        video_id: videoId,
        created_at: new Date(),
      })
      .returning('*');

    // Deduct from sender
    const senderTransaction = await this.deductCoins(
      senderId,
      gift.coins,
      'gift_sent',
      `Sent ${gift.name} gift`,
      giftRecord.id
    );

    // Add to receiver
    const receiverTransaction = await this.addCoins(
      receiverId,
      gift.coins,
      'gift_received',
      `Received ${gift.name} gift`,
      giftRecord.id
    );

    logger.info(`Gift sent: ${senderId} -> ${receiverId}, ${giftType} (${gift.coins} coins)`);

    return { senderTransaction, receiverTransaction };
  }

  // Purchase coins
  async purchaseCoins(
    userId: string,
    packageId: string,
    paymentIntentId: string
  ): Promise<Transaction> {
    const coinPackage = COIN_PACKAGES.find(p => p.id === packageId);
    if (!coinPackage) {
      throw new Error('Invalid package');
    }

    const totalCoins = coinPackage.coins + coinPackage.bonus;

    const transaction = await this.addCoins(
      userId,
      totalCoins,
      'purchase',
      `Purchased ${coinPackage.coins} coins${coinPackage.bonus > 0 ? ` + ${coinPackage.bonus} bonus` : ''}`,
      paymentIntentId
    );

    logger.info(`Coins purchased: ${userId}, ${packageId}, ${totalCoins} coins`);
    return transaction;
  }

  // Request withdrawal
  async requestWithdrawal(
    userId: string,
    amount: number,
    paymentMethod: 'bank' | 'paypal' | 'upi',
    paymentDetails: Record<string, string>
  ): Promise<any> {
    const wallet = await this.getWallet(userId);

    if (amount < config.withdrawal.minAmount) {
      throw new Error(`Minimum withdrawal amount is ${config.withdrawal.minAmount} coins`);
    }

    if (wallet.balance < amount) {
      throw new Error('Insufficient balance');
    }

    const fee = Math.floor(amount * (config.withdrawal.feePercent / 100));
    const netAmount = amount - fee;

    // Create withdrawal request
    const [withdrawal] = await db('ce_withdrawals')
      .insert({
        user_id: userId,
        amount,
        fee,
        net_amount: netAmount,
        payment_method: paymentMethod,
        payment_details: JSON.stringify(paymentDetails),
        status: 'pending',
        created_at: new Date(),
      })
      .returning('*');

    // Deduct from balance
    await this.deductCoins(
      userId,
      amount,
      'withdrawal',
      `Withdrawal request (${paymentMethod})`,
      withdrawal.id
    );

    logger.info(`Withdrawal requested: ${userId}, ${amount} coins, method: ${paymentMethod}`);
    return withdrawal;
  }

  // Get transaction history
  async getTransactions(
    userId: string,
    page: number = 1,
    limit: number = 20,
    type?: TransactionType
  ): Promise<PaginatedResponse<Transaction>> {
    const offset = (page - 1) * limit;

    let query = db('ce_transactions').where('user_id', userId);
    let countQuery = db('ce_transactions').where('user_id', userId);

    if (type) {
      query = query.where('type', type);
      countQuery = countQuery.where('type', type);
    }

    const [transactions, totalResult] = await Promise.all([
      query.orderBy('created_at', 'desc').offset(offset).limit(limit),
      countQuery.count('id as count').first(),
    ]);

    const total = parseInt(totalResult?.count as string) || 0;

    return {
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  // Get gifts received (for a user or video)
  async getGiftsReceived(
    receiverId: string,
    videoId?: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<any>> {
    const offset = (page - 1) * limit;

    let query = db('ce_gifts')
      .select('ce_gifts.*', 'ce_users.username as sender_username', 'ce_users.profile_picture as sender_avatar')
      .join('ce_users', 'ce_gifts.sender_id', 'ce_users.id')
      .where('receiver_id', receiverId);

    let countQuery = db('ce_gifts').where('receiver_id', receiverId);

    if (videoId) {
      query = query.where('video_id', videoId);
      countQuery = countQuery.where('video_id', videoId);
    }

    const [gifts, totalResult] = await Promise.all([
      query.orderBy('ce_gifts.created_at', 'desc').offset(offset).limit(limit),
      countQuery.count('id as count').first(),
    ]);

    const total = parseInt(totalResult?.count as string) || 0;

    return {
      data: gifts.map((g: any) => ({
        ...g,
        gift: GIFT_TYPES[g.gift_type as keyof typeof GIFT_TYPES],
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  // Get withdrawal history
  async getWithdrawals(userId: string, page: number = 1, limit: number = 20): Promise<PaginatedResponse<any>> {
    const offset = (page - 1) * limit;

    const [withdrawals, totalResult] = await Promise.all([
      db('ce_withdrawals')
        .where('user_id', userId)
        .orderBy('created_at', 'desc')
        .offset(offset)
        .limit(limit),
      db('ce_withdrawals')
        .where('user_id', userId)
        .count('id as count')
        .first(),
    ]);

    const total = parseInt(totalResult?.count as string) || 0;

    return {
      data: withdrawals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  // Get coin packages
  getCoinPackages() {
    return COIN_PACKAGES;
  }

  // Get gift types
  getGiftTypes() {
    return GIFT_TYPES;
  }

  // Get transaction by ID
  async getTransactionById(transactionId: string, userId: string): Promise<Transaction | null> {
    const transaction = await db('ce_transactions')
      .where({ id: transactionId, user_id: userId })
      .first();
    return transaction || null;
  }

  // Get sent gifts
  async getSentGifts(
    senderId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<any>> {
    const offset = (page - 1) * limit;

    const [gifts, totalResult] = await Promise.all([
      db('ce_gifts')
        .select('ce_gifts.*', 'ce_users.username as receiver_username', 'ce_users.profile_picture as receiver_avatar')
        .join('ce_users', 'ce_gifts.receiver_id', 'ce_users.id')
        .where('sender_id', senderId)
        .orderBy('ce_gifts.created_at', 'desc')
        .offset(offset)
        .limit(limit),
      db('ce_gifts')
        .where('sender_id', senderId)
        .count('id as count')
        .first(),
    ]);

    const total = parseInt(totalResult?.count as string) || 0;

    return {
      data: gifts.map((g: any) => ({
        ...g,
        gift: GIFT_TYPES[g.gift_type as keyof typeof GIFT_TYPES],
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  // Referral system
  async getReferralStats(userId: string): Promise<any> {
    const user = await db('ce_users').where('id', userId).first();
    
    const referralCount = await db('ce_users')
      .where('referred_by', userId)
      .count('id as count')
      .first();

    const referralEarnings = await db('ce_transactions')
      .where('user_id', userId)
      .where('type', 'referral_bonus')
      .sum('amount as total')
      .first();

    return {
      referralCode: user?.referral_code || null,
      referralCount: parseInt(referralCount?.count as string) || 0,
      totalEarnings: parseInt(referralEarnings?.total as string) || 0,
    };
  }

  // Apply referral code
  async applyReferralCode(userId: string, referralCode: string): Promise<void> {
    const referrer = await db('ce_users').where('referral_code', referralCode).first();
    
    if (!referrer) {
      throw new Error('Invalid referral code');
    }

    if (referrer.id === userId) {
      throw new Error('Cannot use your own referral code');
    }

    const user = await db('ce_users').where('id', userId).first();
    
    if (user.referred_by) {
      throw new Error('Referral code already applied');
    }

    await db.transaction(async (trx: any) => {
      // Update user with referrer
      await trx('users')
        .where('id', userId)
        .update({ referred_by: referrer.id });

      // Give bonus to new user
      const newUserBonus = 50; // coins
      await this.addCoins(userId, newUserBonus, 'referral_bonus' as TransactionType, 'Referral signup bonus');

      // Give bonus to referrer
      const referrerBonus = 100; // coins
      await this.addCoins(referrer.id, referrerBonus, 'referral_bonus' as TransactionType, `Referral bonus for ${user.username}`);
    });

    logger.info(`User ${userId} applied referral code from ${referrer.id}`);
  }

  // Get withdrawal by ID
  async getWithdrawalById(withdrawalId: string, userId: string): Promise<any> {
    const withdrawal = await db('ce_withdrawals')
      .where({ id: withdrawalId, user_id: userId })
      .first();
    return withdrawal || null;
  }

  // Get gifter leaderboard
  async getGifterLeaderboard(period: 'daily' | 'weekly' | 'monthly' | 'all' = 'weekly', limit: number = 10): Promise<any[]> {
    let dateFilter;
    const now = new Date();
    
    switch (period) {
      case 'daily':
        dateFilter = new Date(now.setDate(now.getDate() - 1));
        break;
      case 'weekly':
        dateFilter = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'monthly':
        dateFilter = new Date(now.setMonth(now.getMonth() - 1));
        break;
      default:
        dateFilter = null;
    }

    let query = db('ce_gifts')
      .select(
        'sender_id',
        'ce_users.username',
        'ce_users.profile_picture',
        db.raw('SUM(coins) as total_gifted'),
        db.raw('COUNT(*) as gift_count')
      )
      .join('ce_users', 'ce_gifts.sender_id', 'ce_users.id');

    if (dateFilter) {
      query = query.where('ce_gifts.created_at', '>=', dateFilter);
    }

    return query
      .groupBy('sender_id', 'ce_users.username', 'ce_users.profile_picture')
      .orderBy('total_gifted', 'desc')
      .limit(limit);
  }

  // Get earner leaderboard
  async getEarnerLeaderboard(period: 'daily' | 'weekly' | 'monthly' | 'all' = 'weekly', limit: number = 10): Promise<any[]> {
    let dateFilter;
    const now = new Date();
    
    switch (period) {
      case 'daily':
        dateFilter = new Date(now.setDate(now.getDate() - 1));
        break;
      case 'weekly':
        dateFilter = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'monthly':
        dateFilter = new Date(now.setMonth(now.getMonth() - 1));
        break;
      default:
        dateFilter = null;
    }

    let query = db('ce_gifts')
      .select(
        'receiver_id',
        'ce_users.username',
        'ce_users.profile_picture',
        db.raw('SUM(coins) as total_earned'),
        db.raw('COUNT(*) as gift_count')
      )
      .join('ce_users', 'ce_gifts.receiver_id', 'ce_users.id');

    if (dateFilter) {
      query = query.where('ce_gifts.created_at', '>=', dateFilter);
    }

    return query
      .groupBy('receiver_id', 'ce_users.username', 'ce_users.profile_picture')
      .orderBy('total_earned', 'desc')
      .limit(limit);
  }
}

export const walletService = new WalletService();
