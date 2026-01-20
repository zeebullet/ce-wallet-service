import db from '../db';
import { logger } from '../utils/logger';

export interface BankAccount {
  id: string;
  user_id: string;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  bank_name: string;
  branch_name?: string;
  account_type: string;
  pan_card_number?: string;
  pan_card_image_url?: string;
  cancelled_cheque_url?: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  verification_notes?: string;
  is_primary: boolean;
  is_active: boolean;
  verified_at?: Date;
  created_at: Date;
}

/**
 * Add a bank account
 */
export async function addBankAccount(
  userId: string,
  data: {
    account_holder_name: string;
    account_number: string;
    ifsc_code: string;
    bank_name: string;
    branch_name?: string;
    account_type?: string;
    pan_card_number?: string;
    pan_card_image_url?: string;
    cancelled_cheque_url?: string;
  }
): Promise<BankAccount> {
  // Check if this is the first account
  const existingAccounts = await db('bank_accounts')
    .where('user_id', userId)
    .where('is_active', true)
    .count('* as count')
    .first();

  const isPrimary = parseInt((existingAccounts as any).count) === 0;

  const [account] = await db('bank_accounts')
    .insert({
      user_id: userId,
      account_holder_name: data.account_holder_name,
      account_number: data.account_number,
      ifsc_code: data.ifsc_code,
      bank_name: data.bank_name,
      branch_name: data.branch_name,
      account_type: data.account_type || 'savings',
      pan_card_number: data.pan_card_number,
      pan_card_image_url: data.pan_card_image_url,
      cancelled_cheque_url: data.cancelled_cheque_url,
      verification_status: 'pending',
      is_primary: isPrimary,
      is_active: true
    })
    .returning('*');

  logger.info(`Bank account added for user ${userId}`);
  return account;
}

/**
 * Get user's bank accounts
 */
export async function getBankAccounts(userId: string): Promise<BankAccount[]> {
  return db('bank_accounts')
    .where('user_id', userId)
    .where('is_active', true)
    .orderBy([
      { column: 'is_primary', order: 'desc' },
      { column: 'created_at', order: 'desc' }
    ]);
}

/**
 * Get bank account by ID
 */
export async function getBankAccountById(accountId: string): Promise<BankAccount | null> {
  const account = await db('bank_accounts')
    .where('id', accountId)
    .first();

  return account || null;
}

/**
 * Set primary bank account
 */
export async function setPrimaryAccount(userId: string, accountId: string): Promise<void> {
  // Verify account belongs to user
  const account = await db('bank_accounts')
    .where('id', accountId)
    .where('user_id', userId)
    .first();

  if (!account) {
    throw new Error('Bank account not found');
  }

  // Remove primary from all accounts
  await db('bank_accounts')
    .where('user_id', userId)
    .update({ is_primary: false });

  // Set new primary
  await db('bank_accounts')
    .where('id', accountId)
    .update({ is_primary: true });

  logger.info(`Primary account set: ${accountId} for user ${userId}`);
}

/**
 * Delete (deactivate) bank account
 */
export async function deleteBankAccount(userId: string, accountId: string): Promise<void> {
  const account = await db('bank_accounts')
    .where('id', accountId)
    .where('user_id', userId)
    .first();

  if (!account) {
    throw new Error('Bank account not found');
  }

  await db('bank_accounts')
    .where('id', accountId)
    .update({ is_active: false });

  // If was primary, make another one primary
  if (account.is_primary) {
    const nextAccount = await db('bank_accounts')
      .where('user_id', userId)
      .where('is_active', true)
      .first();

    if (nextAccount) {
      await db('bank_accounts')
        .where('id', nextAccount.id)
        .update({ is_primary: true });
    }
  }

  logger.info(`Bank account deleted: ${accountId} for user ${userId}`);
}

/**
 * Verify bank account (Admin)
 */
export async function verifyBankAccount(
  accountId: string,
  verified: boolean,
  notes?: string
): Promise<BankAccount> {
  const [account] = await db('bank_accounts')
    .where('id', accountId)
    .update({
      verification_status: verified ? 'verified' : 'rejected',
      verification_notes: notes,
      verified_at: verified ? new Date() : null
    })
    .returning('*');

  logger.info(`Bank account ${verified ? 'verified' : 'rejected'}: ${accountId}`);
  return account;
}

/**
 * Get pending verification accounts (Admin)
 */
export async function getPendingVerifications(
  page: number = 1,
  limit: number = 20
): Promise<{ accounts: BankAccount[]; pagination: any }> {
  const offset = (page - 1) * limit;

  const accounts = await db('bank_accounts')
    .join('ce_users', 'bank_accounts.user_id', 'ce_users.id')
    .where('bank_accounts.verification_status', 'pending')
    .where('bank_accounts.is_active', true)
    .select(
      'bank_accounts.*',
      'ce_users.username',
      'ce_users.email',
      'ce_users.display_name'
    )
    .orderBy('bank_accounts.created_at', 'asc')
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db('bank_accounts')
    .where('verification_status', 'pending')
    .where('is_active', true)
    .count('* as count');

  return {
    accounts,
    pagination: {
      page,
      limit,
      total: parseInt(count as string),
      totalPages: Math.ceil(parseInt(count as string) / limit)
    }
  };
}
