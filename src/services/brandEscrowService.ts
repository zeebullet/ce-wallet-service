import db from '../db';
import { logger } from '../utils/logger';
import * as razorpayService from './razorpayService';
import * as brandWalletService from './brandWalletService';
import {
  notifyBrandTokenEscrowSuccess,
  notifyBrandWalletRefund,
  notifyBrandLowWalletBalance,
} from './notificationService';

// ============ INTERFACES ============

export interface InitiateEscrowDepositInput {
  amount: number;           // Amount to deposit
  brand_id: string;
  user_id: string;
  campaign_id?: string;     // Optional: if depositing for a specific campaign
}

export interface InitiateEscrowDepositResponse {
  requires_payment: boolean;
  amount_to_pay: number;
  current_balance: number;
  order_id?: string;
  razorpay_key_id?: string;
  transaction_id?: string;
  currency: string;
}

export interface VerifyEscrowDepositInput {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  transaction_id: string;
}

export interface HoldEscrowInput {
  brand_id: string;
  user_id: string;
  amount: number;
  campaign_id: string;
  campaign_title: string;
}

export interface ReleaseEscrowInput {
  brand_id: string;
  user_id: string;
  amount: number;
  campaign_id: string;
  application_id: string;
  creator_id: string;
  creator_name?: string;
}

export interface RefundEscrowInput {
  brand_id: string;
  user_id: string;
  amount: number;
  campaign_id: string;
  reason: string;
}

// ============ ESCROW DEPOSIT FUNCTIONS ============

/**
 * Get current escrow balance details
 */
export async function getEscrowBalance(brandId: string): Promise<{
  escrow_balance: number;
  escrow_on_hold: number;
  available_balance: number;
  total_deposited: number;
  total_released: number;
  total_refunded: number;
}> {
  const wallet = await db('brand_wallets')
    .where('brand_id', brandId)
    .first();

  if (!wallet) {
    throw new Error('Brand wallet not found');
  }

  const escrowBalance = parseFloat(wallet.escrow_balance) || 0;
  const escrowOnHold = parseFloat(wallet.escrow_on_hold) || 0;

  return {
    escrow_balance: escrowBalance,
    escrow_on_hold: escrowOnHold,
    available_balance: escrowBalance, // escrow_balance IS the available balance
    total_deposited: parseFloat(wallet.total_escrow_deposited) || 0,
    total_released: parseFloat(wallet.total_escrow_released) || 0,
    total_refunded: parseFloat(wallet.total_escrow_refunded) || 0,
  };
}

/**
 * Initiate escrow deposit - Check if payment needed and create Razorpay order
 */
export async function initiateEscrowDeposit(
  input: InitiateEscrowDepositInput
): Promise<InitiateEscrowDepositResponse> {
  const { amount, brand_id, user_id, campaign_id } = input;

  if (amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  // Get current escrow balance
  const wallet = await db('brand_wallets')
    .where('brand_id', brand_id)
    .first();

  if (!wallet) {
    throw new Error('Brand wallet not found. Please complete your profile setup.');
  }

  const currentBalance = parseFloat(wallet.escrow_balance) || 0;

  // If brand already has enough balance, no payment needed
  if (currentBalance >= amount) {
    return {
      requires_payment: false,
      amount_to_pay: 0,
      current_balance: currentBalance,
      currency: 'INR',
    };
  }

  // Calculate amount to pay (shortfall)
  const amountToPay = amount - currentBalance;

  // Generate unique receipt
  const timestamp = Date.now();
  const receipt = `escrow_${brand_id.substring(0, 8)}_${timestamp}`;

  // Create Razorpay order
  const razorpayOrder = await razorpayService.createOrder({
    amount: Math.round(amountToPay * 100), // Convert to paise
    currency: 'INR',
    receipt: receipt,
    notes: {
      brand_id,
      user_id,
      campaign_id: campaign_id || '',
      type: 'escrow_deposit',
      total_required: amount,
      current_balance: currentBalance,
      amount_to_pay: amountToPay,
    },
  });

  // Create pending transaction
  const [transaction] = await db('brand_transactions')
    .insert({
      brand_id,
      user_id,
      transaction_type: 'escrow_deposit',
      amount: amountToPay,
      currency: 'INR',
      currency_type: 'escrow',
      balance_after: currentBalance, // Will be updated on verification
      reference_type: campaign_id ? 'campaign' : 'direct_deposit',
      reference_id: campaign_id || null,
      payment_method: 'razorpay',
      payment_gateway_id: razorpayOrder.id,
      status: 'pending',
      description: campaign_id 
        ? `Escrow deposit for campaign`
        : `Direct escrow deposit`,
      metadata: JSON.stringify({
        razorpay_order_id: razorpayOrder.id,
        receipt,
        total_required: amount,
        current_balance: currentBalance,
        amount_to_pay: amountToPay,
      }),
    })
    .returning('*');

  logger.info('[Escrow] Initiated escrow deposit', {
    brand_id,
    amount_to_pay: amountToPay,
    razorpay_order_id: razorpayOrder.id,
    transaction_id: transaction.id,
  });

  return {
    requires_payment: true,
    amount_to_pay: amountToPay,
    current_balance: currentBalance,
    order_id: razorpayOrder.id,
    razorpay_key_id: razorpayService.getKeyId(),
    transaction_id: transaction.id,
    currency: 'INR',
  };
}

/**
 * Verify escrow deposit payment and credit to wallet
 */
export async function verifyEscrowDeposit(
  input: VerifyEscrowDepositInput
): Promise<{
  success: boolean;
  new_balance: number;
  amount_credited: number;
  transaction_id: string;
}> {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, transaction_id } = input;

  // Find pending transaction
  const transaction = await db('brand_transactions')
    .where('id', transaction_id)
    .where('payment_gateway_id', razorpay_order_id)
    .where('status', 'pending')
    .first();

  if (!transaction) {
    throw new Error('Transaction not found or already processed');
  }

  // Verify signature
  const isValid = razorpayService.verifyPaymentSignature({
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  });

  if (!isValid) {
    await db('brand_transactions')
      .where('id', transaction_id)
      .update({
        status: 'failed',
        failure_reason: 'Invalid payment signature',
      });

    throw new Error('Payment verification failed');
  }

  const amountToCredit = parseFloat(transaction.amount) || 0;

  // Credit escrow to wallet
  const trx = await db.transaction();

  try {
    // Update wallet
    const [wallet] = await trx('brand_wallets')
      .where('brand_id', transaction.brand_id)
      .increment('escrow_balance', amountToCredit)
      .increment('total_escrow_deposited', amountToCredit)
      .update({
        last_transaction_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    const newBalance = parseFloat(wallet.escrow_balance) || 0;

    // Update transaction
    await trx('brand_transactions')
      .where('id', transaction_id)
      .update({
        status: 'completed',
        balance_after: newBalance,
        processed_at: new Date(),
        metadata: trx.raw(`metadata || ?::jsonb`, [JSON.stringify({
          razorpay_payment_id,
          verified_at: new Date().toISOString(),
          amount_credited: amountToCredit,
          new_balance: newBalance,
        })]),
      });

    await trx.commit();

    logger.info('[Escrow] Deposit verified and credited', {
      transaction_id,
      brand_id: transaction.brand_id,
      amount_credited: amountToCredit,
      new_balance: newBalance,
    });

    return {
      success: true,
      new_balance: newBalance,
      amount_credited: amountToCredit,
      transaction_id,
    };
  } catch (error: any) {
    await trx.rollback();
    
    await db('brand_transactions')
      .where('id', transaction_id)
      .update({
        status: 'failed',
        failure_reason: error.message,
      });

    throw new Error('Failed to credit escrow. Please contact support.');
  }
}

// ============ ESCROW HOLD/RELEASE/REFUND FUNCTIONS ============

/**
 * Hold escrow for a campaign (move from available to on_hold)
 */
export async function holdEscrow(input: HoldEscrowInput): Promise<{
  success: boolean;
  escrow_balance: number;
  escrow_on_hold: number;
}> {
  const { brand_id, user_id, amount, campaign_id, campaign_title } = input;

  if (amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  const trx = await db.transaction();

  try {
    // Get current wallet
    const wallet = await trx('brand_wallets')
      .where('brand_id', brand_id)
      .first();

    if (!wallet) {
      throw new Error('Brand wallet not found');
    }

    const currentBalance = parseFloat(wallet.escrow_balance) || 0;

    if (currentBalance < amount) {
      throw new Error(`Insufficient escrow balance. Available: ₹${currentBalance}, Required: ₹${amount}`);
    }

    // Update wallet: decrease balance, increase on_hold
    const [updatedWallet] = await trx('brand_wallets')
      .where('brand_id', brand_id)
      .decrement('escrow_balance', amount)
      .increment('escrow_on_hold', amount)
      .update({
        last_transaction_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    // Create transaction record
    await trx('brand_transactions').insert({
      brand_id,
      user_id,
      transaction_type: 'escrow_hold',
      amount,
      currency: 'INR',
      currency_type: 'escrow',
      balance_after: parseFloat(updatedWallet.escrow_balance) || 0,
      reference_type: 'campaign',
      reference_id: campaign_id,
      status: 'completed',
      description: `Escrow held for campaign: ${campaign_title}`,
      metadata: JSON.stringify({
        campaign_id,
        campaign_title,
        held_amount: amount,
        new_on_hold: parseFloat(updatedWallet.escrow_on_hold) || 0,
      }),
      processed_at: new Date(),
    });

    await trx.commit();

    logger.info('[Escrow] Escrow held for campaign', {
      brand_id,
      campaign_id,
      amount,
      new_balance: updatedWallet.escrow_balance,
      new_on_hold: updatedWallet.escrow_on_hold,
    });

    // Send notification to brand about escrow hold
    notifyBrandTokenEscrowSuccess(
      user_id,
      amount,
      campaign_title,
      campaign_id,
      parseFloat(updatedWallet.escrow_balance) || 0
    ).catch(err => logger.error('[Escrow] Failed to send escrow notification', { error: err.message }));

    // Check if balance is low after hold
    const remainingBalance = parseFloat(updatedWallet.escrow_balance) || 0;
    if (remainingBalance < 1000 && remainingBalance > 0) {
      notifyBrandLowWalletBalance(user_id, remainingBalance, 1000)
        .catch(err => logger.error('[Escrow] Failed to send low balance notification', { error: err.message }));
    }

    return {
      success: true,
      escrow_balance: parseFloat(updatedWallet.escrow_balance) || 0,
      escrow_on_hold: parseFloat(updatedWallet.escrow_on_hold) || 0,
    };
  } catch (error: any) {
    await trx.rollback();
    throw error;
  }
}

/**
 * Release escrow to creator (pay creator from on_hold)
 */
export async function releaseEscrow(input: ReleaseEscrowInput): Promise<{
  success: boolean;
  escrow_on_hold: number;
  total_released: number;
  creator_payment_amount: number;
}> {
  const { brand_id, user_id, amount, campaign_id, application_id, creator_id, creator_name } = input;

  if (amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  const trx = await db.transaction();

  try {
    // Get current wallet
    const wallet = await trx('brand_wallets')
      .where('brand_id', brand_id)
      .first();

    if (!wallet) {
      throw new Error('Brand wallet not found');
    }

    const currentOnHold = parseFloat(wallet.escrow_on_hold) || 0;

    if (currentOnHold < amount) {
      throw new Error(`Insufficient escrow on hold. On hold: ₹${currentOnHold}, Required: ₹${amount}`);
    }

    // Update brand wallet: decrease on_hold, increase released
    const [updatedWallet] = await trx('brand_wallets')
      .where('brand_id', brand_id)
      .decrement('escrow_on_hold', amount)
      .increment('total_escrow_released', amount)
      .update({
        last_transaction_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    // Create brand transaction record (escrow release)
    await trx('brand_transactions').insert({
      brand_id,
      user_id,
      transaction_type: 'escrow_release',
      amount,
      currency: 'INR',
      currency_type: 'escrow',
      balance_after: parseFloat(updatedWallet.escrow_balance) || 0,
      reference_type: 'application',
      reference_id: application_id,
      status: 'completed',
      description: `Escrow released to creator${creator_name ? `: ${creator_name}` : ''}`,
      metadata: JSON.stringify({
        campaign_id,
        application_id,
        creator_id,
        creator_name,
        released_amount: amount,
      }),
      processed_at: new Date(),
    });

    // Credit to creator's wallet
    // First, get or create creator wallet
    let creatorWallet = await trx('wallets')
      .where('user_id', creator_id)
      .first();

    if (!creatorWallet) {
      [creatorWallet] = await trx('wallets')
        .insert({
          user_id: creator_id,
          balance: 0,
          pending_balance: 0,
          total_earnings: 0,
          total_withdrawals: 0,
          currency: 'INR',
        })
        .returning('*');
    }

    const newCreatorBalance = (parseFloat(creatorWallet.balance) || 0) + amount;

    // Update creator wallet
    await trx('wallets')
      .where('user_id', creator_id)
      .increment('balance', amount)
      .increment('total_earnings', amount)
      .update({
        last_transaction_at: new Date(),
        updated_at: new Date(),
      });

    // Create creator transaction record
    await trx('transactions').insert({
      user_id: creator_id,
      transaction_type: 'earning',
      amount,
      currency: 'INR',
      balance_after: newCreatorBalance,
      reference_type: 'campaign',
      reference_id: campaign_id,
      status: 'completed',
      description: `Campaign payment received`,
      metadata: JSON.stringify({
        campaign_id,
        application_id,
        brand_id,
      }),
    });

    await trx.commit();

    logger.info('[Escrow] Escrow released to creator', {
      brand_id,
      creator_id,
      campaign_id,
      application_id,
      amount,
    });

    return {
      success: true,
      escrow_on_hold: parseFloat(updatedWallet.escrow_on_hold) || 0,
      total_released: parseFloat(updatedWallet.total_escrow_released) || 0,
      creator_payment_amount: amount,
    };
  } catch (error: any) {
    await trx.rollback();
    throw error;
  }
}

/**
 * Refund escrow (move from on_hold back to available balance)
 */
export async function refundEscrow(input: RefundEscrowInput): Promise<{
  success: boolean;
  escrow_balance: number;
  escrow_on_hold: number;
  total_refunded: number;
}> {
  const { brand_id, user_id, amount, campaign_id, reason } = input;

  if (amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  const trx = await db.transaction();

  try {
    // Get current wallet
    const wallet = await trx('brand_wallets')
      .where('brand_id', brand_id)
      .first();

    if (!wallet) {
      throw new Error('Brand wallet not found');
    }

    const currentOnHold = parseFloat(wallet.escrow_on_hold) || 0;

    if (currentOnHold < amount) {
      throw new Error(`Insufficient escrow on hold. On hold: ₹${currentOnHold}, Requested refund: ₹${amount}`);
    }

    // Update wallet: decrease on_hold, increase balance, increase refunded
    const [updatedWallet] = await trx('brand_wallets')
      .where('brand_id', brand_id)
      .decrement('escrow_on_hold', amount)
      .increment('escrow_balance', amount)
      .increment('total_escrow_refunded', amount)
      .update({
        last_transaction_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    // Create transaction record
    await trx('brand_transactions').insert({
      brand_id,
      user_id,
      transaction_type: 'escrow_refund',
      amount,
      currency: 'INR',
      currency_type: 'escrow',
      balance_after: parseFloat(updatedWallet.escrow_balance) || 0,
      reference_type: 'campaign',
      reference_id: campaign_id,
      status: 'completed',
      description: `Escrow refunded: ${reason}`,
      metadata: JSON.stringify({
        campaign_id,
        refund_reason: reason,
        refunded_amount: amount,
      }),
      processed_at: new Date(),
    });

    await trx.commit();

    logger.info('[Escrow] Escrow refunded', {
      brand_id,
      campaign_id,
      amount,
      reason,
      new_balance: updatedWallet.escrow_balance,
      new_on_hold: updatedWallet.escrow_on_hold,
    });

    // Send notification to brand about refund
    notifyBrandWalletRefund(
      user_id,
      amount,
      reason,
      undefined, // campaign title not available in this context
      campaign_id
    ).catch(err => logger.error('[Escrow] Failed to send refund notification', { error: err.message }));

    return {
      success: true,
      escrow_balance: parseFloat(updatedWallet.escrow_balance) || 0,
      escrow_on_hold: parseFloat(updatedWallet.escrow_on_hold) || 0,
      total_refunded: parseFloat(updatedWallet.total_escrow_refunded) || 0,
    };
  } catch (error: any) {
    await trx.rollback();
    throw error;
  }
}

/**
 * Get escrow transactions for a brand
 */
export async function getEscrowTransactions(
  brandId: string,
  page: number = 1,
  limit: number = 20
): Promise<{
  transactions: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  const offset = (page - 1) * limit;

  const [{ count }] = await db('brand_transactions')
    .where('brand_id', brandId)
    .where('currency_type', 'escrow')
    .count();

  const total = parseInt(count as string, 10);

  const transactions = await db('brand_transactions')
    .where('brand_id', brandId)
    .where('currency_type', 'escrow')
    .orderBy('created_at', 'desc')
    .offset(offset)
    .limit(limit);

  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
