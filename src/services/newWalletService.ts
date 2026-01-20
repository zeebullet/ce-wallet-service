import db from '../db';
import { logger } from '../utils/logger';

export interface Wallet {
  user_id: string;
  balance: number;
  pending_balance: number;
  total_earnings: number;
  total_withdrawals: number;
  currency: string;
  last_transaction_at?: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * Get or create wallet for user
 */
export async function getOrCreateWallet(userId: string): Promise<Wallet> {
  let wallet = await db('wallets').where('user_id', userId).first();

  if (!wallet) {
    [wallet] = await db('wallets')
      .insert({
        user_id: userId,
        balance: 0,
        pending_balance: 0,
        total_earnings: 0,
        total_withdrawals: 0,
        currency: 'INR'
      })
      .returning('*');

    logger.info(`Wallet created for user ${userId}`);
  }

  return {
    ...wallet,
    balance: parseFloat(wallet.balance) || 0,
    pending_balance: parseFloat(wallet.pending_balance) || 0,
    total_earnings: parseFloat(wallet.total_earnings) || 0,
    total_withdrawals: parseFloat(wallet.total_withdrawals) || 0
  };
}

/**
 * Get wallet balance
 */
export async function getBalance(userId: string): Promise<{
  balance: number;
  pending_balance: number;
  available_balance: number;
  currency: string;
}> {
  const wallet = await getOrCreateWallet(userId);
  
  return {
    balance: wallet.balance,
    pending_balance: wallet.pending_balance,
    available_balance: wallet.balance - wallet.pending_balance,
    currency: wallet.currency
  };
}

/**
 * Add earnings to wallet
 */
export async function addEarnings(
  userId: string,
  amount: number,
  source: string
): Promise<Wallet> {
  const wallet = await getOrCreateWallet(userId);

  const [updated] = await db('wallets')
    .where('user_id', userId)
    .update({
      balance: db.raw('balance + ?', [amount]),
      total_earnings: db.raw('total_earnings + ?', [amount]),
      last_transaction_at: new Date(),
      updated_at: new Date()
    })
    .returning('*');

  logger.info(`Added ${amount} to wallet for user ${userId} from ${source}`);
  return updated;
}

/**
 * Deduct from wallet
 */
export async function deductFromWallet(
  userId: string,
  amount: number,
  reason: string
): Promise<Wallet> {
  const wallet = await getOrCreateWallet(userId);

  if (wallet.balance < amount) {
    throw new Error('Insufficient balance');
  }

  const [updated] = await db('wallets')
    .where('user_id', userId)
    .update({
      balance: db.raw('balance - ?', [amount]),
      last_transaction_at: new Date(),
      updated_at: new Date()
    })
    .returning('*');

  logger.info(`Deducted ${amount} from wallet for user ${userId}: ${reason}`);
  return updated;
}

/**
 * Get wallet summary with stats
 */
export async function getWalletSummary(userId: string): Promise<{
  wallet: Wallet;
  stats: {
    total_earnings: number;
    total_withdrawals: number;
    pending_withdrawals: number;
    available_for_withdrawal: number;
  };
}> {
  const wallet = await getOrCreateWallet(userId);

  // Get pending withdrawals
  const pendingResult = await db('transactions')
    .where('user_id', userId)
    .where('transaction_type', 'withdrawal')
    .whereIn('status', ['pending', 'processing'])
    .sum('amount as total')
    .first();

  const pendingWithdrawals = Math.abs(parseFloat((pendingResult as any)?.total)) || 0;

  return {
    wallet,
    stats: {
      total_earnings: wallet.total_earnings,
      total_withdrawals: wallet.total_withdrawals,
      pending_withdrawals: pendingWithdrawals,
      available_for_withdrawal: wallet.balance - pendingWithdrawals
    }
  };
}

/**
 * Process campaign payment to creator
 */
export async function processCampaignPayment(
  creatorUserId: string,
  campaignId: string,
  applicationId: string,
  amount: number
): Promise<void> {
  await db.transaction(async (trx: any) => {
    // Add to creator wallet
    await trx('wallets')
      .where('user_id', creatorUserId)
      .update({
        balance: trx.raw('balance + ?', [amount]),
        total_earnings: trx.raw('total_earnings + ?', [amount]),
        last_transaction_at: new Date(),
        updated_at: new Date()
      });

    // Create transaction record
    await trx('transactions').insert({
      user_id: creatorUserId,
      transaction_type: 'campaign_earning',
      amount: amount,
      currency: 'INR',
      status: 'completed',
      description: `Campaign payment`,
      reference_id: applicationId,
      reference_type: 'campaign_application',
      processed_at: new Date()
    });

    // Update campaign application payment status
    await trx('campaign_applications')
      .where('id', applicationId)
      .update({
        payment_status: 'paid',
        payment_processed_at: new Date()
      });
  });

  logger.info(`Campaign payment processed: ${amount} to user ${creatorUserId} for application ${applicationId}`);
}

/**
 * Get leaderboard by earnings
 */
export async function getEarningsLeaderboard(
  period: 'all_time' | 'monthly' | 'weekly' = 'all_time',
  limit: number = 10
): Promise<any[]> {
  let query = db('wallets')
    .join('ce_users', 'wallets.user_id', 'ce_users.id')
    .join('ce_creator_profiles', 'wallets.user_id', 'ce_creator_profiles.user_id')
    .where('ce_creator_profiles.application_status', 'approved');

  if (period === 'monthly') {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // For monthly, we'd need to sum from transactions table
    return db('transactions')
      .join('ce_users', 'transactions.user_id', 'ce_users.id')
      .where('transactions.transaction_type', 'campaign_earning')
      .where('transactions.status', 'completed')
      .where('transactions.created_at', '>=', startOfMonth)
      .groupBy('transactions.user_id', 'ce_users.username', 'ce_users.full_name', 'ce_users.profile_picture_url')
      .select(
        'transactions.user_id',
        'ce_users.username',
        'ce_users.full_name as display_name',
        'ce_users.profile_picture_url as avatar_url',
        db.raw('SUM(transactions.amount) as total_earned')
      )
      .orderBy('total_earned', 'desc')
      .limit(limit);
  }

  if (period === 'weekly') {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    return db('transactions')
      .join('ce_users', 'transactions.user_id', 'ce_users.id')
      .where('transactions.transaction_type', 'campaign_earning')
      .where('transactions.status', 'completed')
      .where('transactions.created_at', '>=', startOfWeek)
      .groupBy('transactions.user_id', 'ce_users.username', 'ce_users.full_name', 'ce_users.profile_picture_url')
      .select(
        'transactions.user_id',
        'ce_users.username',
        'ce_users.full_name as display_name',
        'ce_users.profile_picture_url as avatar_url',
        db.raw('SUM(transactions.amount) as total_earned')
      )
      .orderBy('total_earned', 'desc')
      .limit(limit);
  }

  // All time
  return query
    .select(
      'wallets.user_id',
      'ce_users.username',
      'ce_users.full_name as display_name',
      'ce_users.profile_picture_url as avatar_url',
      'wallets.total_earnings as total_earned'
    )
    .orderBy('wallets.total_earnings', 'desc')
    .limit(limit);
}
