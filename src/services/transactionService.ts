import db from '../db';
import { logger } from '../utils/logger';

export interface Transaction {
  id: string;
  user_id: string;
  transaction_type: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  reference_id?: string;
  reference_type?: string;
  payment_method?: string;
  bank_account_id?: string;
  external_transaction_id?: string;
  failure_reason?: string;
  processed_at?: Date;
  created_at: Date;
}

export type TransactionType = 
  | 'deposit'
  | 'withdrawal'
  | 'gift_sent'
  | 'gift_received'
  | 'campaign_earning'
  | 'campaign_payment'
  | 'refund'
  | 'adjustment';

/**
 * Create a transaction
 */
export async function createTransaction(data: {
  user_id: string;
  transaction_type: TransactionType;
  amount: number;
  currency?: string;
  description?: string;
  reference_id?: string;
  reference_type?: string;
  payment_method?: string;
  bank_account_id?: string;
  external_transaction_id?: string;
}): Promise<Transaction> {
  const [transaction] = await db('transactions')
    .insert({
      user_id: data.user_id,
      transaction_type: data.transaction_type,
      amount: data.amount,
      currency: data.currency || 'INR',
      status: 'pending',
      description: data.description,
      reference_id: data.reference_id,
      reference_type: data.reference_type,
      payment_method: data.payment_method,
      bank_account_id: data.bank_account_id,
      external_transaction_id: data.external_transaction_id
    })
    .returning('*');

  logger.info(`Transaction created: ${transaction.id} for user ${data.user_id}`);
  return transaction;
}

/**
 * Get transaction by ID
 */
export async function getTransactionById(transactionId: string): Promise<Transaction | null> {
  const transaction = await db('transactions')
    .where('id', transactionId)
    .first();

  return transaction || null;
}

/**
 * Get user transactions
 */
export async function getUserTransactions(
  userId: string,
  page: number = 1,
  limit: number = 20,
  filters?: {
    transaction_type?: string;
    status?: string;
    start_date?: Date;
    end_date?: Date;
  }
): Promise<{ transactions: Transaction[]; pagination: any }> {
  const offset = (page - 1) * limit;

  let query = db('transactions').where('user_id', userId);

  if (filters?.transaction_type) {
    query = query.where('transaction_type', filters.transaction_type);
  }

  if (filters?.status) {
    query = query.where('status', filters.status);
  }

  if (filters?.start_date) {
    query = query.where('created_at', '>=', filters.start_date);
  }

  if (filters?.end_date) {
    query = query.where('created_at', '<=', filters.end_date);
  }

  const transactions = await query
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);

  // Count
  let countQuery = db('transactions').where('user_id', userId);
  if (filters?.transaction_type) countQuery = countQuery.where('transaction_type', filters.transaction_type);
  if (filters?.status) countQuery = countQuery.where('status', filters.status);

  const [{ count }] = await countQuery.count('* as count');

  return {
    transactions,
    pagination: {
      page,
      limit,
      total: parseInt(count as string),
      totalPages: Math.ceil(parseInt(count as string) / limit)
    }
  };
}

/**
 * Update transaction status
 */
export async function updateTransactionStatus(
  transactionId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled',
  data?: {
    external_transaction_id?: string;
    failure_reason?: string;
  }
): Promise<Transaction> {
  const updates: any = { status };

  if (status === 'completed') {
    updates.processed_at = new Date();
  }

  if (data?.external_transaction_id) {
    updates.external_transaction_id = data.external_transaction_id;
  }

  if (data?.failure_reason) {
    updates.failure_reason = data.failure_reason;
  }

  const [transaction] = await db('transactions')
    .where('id', transactionId)
    .update(updates)
    .returning('*');

  logger.info(`Transaction status updated: ${transactionId} -> ${status}`);
  return transaction;
}

/**
 * Request withdrawal
 */
export async function requestWithdrawal(
  userId: string,
  amount: number,
  bankAccountId: string
): Promise<Transaction> {
  // Verify bank account belongs to user and is verified
  const bankAccount = await db('bank_accounts')
    .where('id', bankAccountId)
    .where('user_id', userId)
    .first();

  if (!bankAccount) {
    throw new Error('Bank account not found');
  }

  if (bankAccount.verification_status !== 'verified') {
    throw new Error('Bank account must be verified for withdrawals');
  }

  // Check wallet balance
  const wallet = await db('wallets').where('user_id', userId).first();
  if (!wallet) {
    throw new Error('Wallet not found');
  }

  if (parseFloat(wallet.balance) < amount) {
    throw new Error('Insufficient balance');
  }

  // Create withdrawal transaction
  const transaction = await createTransaction({
    user_id: userId,
    transaction_type: 'withdrawal',
    amount: -amount,
    description: `Withdrawal to ${bankAccount.bank_name} - ${bankAccount.account_number.slice(-4)}`,
    bank_account_id: bankAccountId,
    payment_method: 'bank_transfer'
  });

  // Update wallet pending balance
  await db('wallets')
    .where('user_id', userId)
    .update({
      balance: db.raw('balance - ?', [amount]),
      pending_balance: db.raw('pending_balance + ?', [amount]),
      last_transaction_at: new Date(),
      updated_at: new Date()
    });

  logger.info(`Withdrawal requested: ${amount} for user ${userId}`);
  return transaction;
}

/**
 * Process withdrawal (Admin/System)
 */
export async function processWithdrawal(
  transactionId: string,
  success: boolean,
  externalTransactionId?: string,
  failureReason?: string
): Promise<Transaction> {
  const transaction = await db('transactions').where('id', transactionId).first();
  if (!transaction) {
    throw new Error('Transaction not found');
  }

  if (transaction.transaction_type !== 'withdrawal') {
    throw new Error('Transaction is not a withdrawal');
  }

  if (transaction.status !== 'pending' && transaction.status !== 'processing') {
    throw new Error('Transaction cannot be processed');
  }

  const amount = Math.abs(parseFloat(transaction.amount));

  if (success) {
    // Update transaction
    await updateTransactionStatus(transactionId, 'completed', { external_transaction_id: externalTransactionId });

    // Update wallet
    await db('wallets')
      .where('user_id', transaction.user_id)
      .update({
        pending_balance: db.raw('pending_balance - ?', [amount]),
        total_withdrawals: db.raw('total_withdrawals + ?', [amount]),
        last_transaction_at: new Date(),
        updated_at: new Date()
      });
  } else {
    // Update transaction
    await updateTransactionStatus(transactionId, 'failed', { failure_reason: failureReason });

    // Refund to wallet
    await db('wallets')
      .where('user_id', transaction.user_id)
      .update({
        balance: db.raw('balance + ?', [amount]),
        pending_balance: db.raw('pending_balance - ?', [amount]),
        last_transaction_at: new Date(),
        updated_at: new Date()
      });
  }

  logger.info(`Withdrawal ${success ? 'completed' : 'failed'}: ${transactionId}`);
  return getTransactionById(transactionId) as Promise<Transaction>;
}

/**
 * Get pending withdrawals (Admin)
 */
export async function getPendingWithdrawals(
  page: number = 1,
  limit: number = 20
): Promise<{ transactions: Transaction[]; pagination: any }> {
  const offset = (page - 1) * limit;

  const transactions = await db('transactions')
    .join('ce_users', 'transactions.user_id', 'ce_users.id')
    .leftJoin('bank_accounts', 'transactions.bank_account_id', 'bank_accounts.id')
    .where('transactions.transaction_type', 'withdrawal')
    .whereIn('transactions.status', ['pending', 'processing'])
    .select(
      'transactions.*',
      'ce_users.username',
      'ce_users.email',
      'bank_accounts.bank_name',
      'bank_accounts.account_number',
      'bank_accounts.ifsc_code',
      'bank_accounts.account_holder_name'
    )
    .orderBy('transactions.created_at', 'asc')
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db('transactions')
    .where('transaction_type', 'withdrawal')
    .whereIn('status', ['pending', 'processing'])
    .count('* as count');

  return {
    transactions,
    pagination: {
      page,
      limit,
      total: parseInt(count as string),
      totalPages: Math.ceil(parseInt(count as string) / limit)
    }
  };
}

/**
 * Get transaction summary for user
 */
export async function getTransactionSummary(userId: string): Promise<{
  total_deposits: number;
  total_withdrawals: number;
  total_earnings: number;
  total_spent: number;
  pending_withdrawals: number;
}> {
  const summary = await db('transactions')
    .where('user_id', userId)
    .where('status', 'completed')
    .select(
      db.raw(`SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE 0 END) as total_deposits`),
      db.raw(`SUM(CASE WHEN transaction_type = 'withdrawal' THEN ABS(amount) ELSE 0 END) as total_withdrawals`),
      db.raw(`SUM(CASE WHEN transaction_type IN ('gift_received', 'campaign_earning') THEN amount ELSE 0 END) as total_earnings`),
      db.raw(`SUM(CASE WHEN transaction_type IN ('gift_sent', 'campaign_payment') THEN ABS(amount) ELSE 0 END) as total_spent`)
    )
    .first();

  const pending = await db('transactions')
    .where('user_id', userId)
    .where('transaction_type', 'withdrawal')
    .whereIn('status', ['pending', 'processing'])
    .sum('amount as total')
    .first();

  return {
    total_deposits: parseFloat(summary?.total_deposits) || 0,
    total_withdrawals: parseFloat(summary?.total_withdrawals) || 0,
    total_earnings: parseFloat(summary?.total_earnings) || 0,
    total_spent: parseFloat(summary?.total_spent) || 0,
    pending_withdrawals: Math.abs(parseFloat((pending as any)?.total)) || 0
  };
}
