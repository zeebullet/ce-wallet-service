import db from '../db';
import { logger } from '../utils/logger';
import * as razorpayService from './razorpayService';
import * as brandWalletService from './brandWalletService';
import {
  notifyBrandDiamondPurchaseSuccess,
  notifyBrandDiamondPurchaseFailed,
  notifyAdminHighValueTransaction,
} from './notificationService';
import { generateBrandPurchaseInvoice } from './invoiceService';

// ============ INTERFACES ============

export interface InitiateRechargeInput {
  package_id: string;
  brand_id: string;
  user_id: string;
}

export interface InitiateRechargeResponse {
  order_id: string;
  razorpay_key_id: string;
  amount: number;
  currency: string;
  transaction_id: string;
  package: {
    id: string;
    name: string;
    display_name: string;
    tokens_included: number;
    price: number;
  };
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
}

export interface VerifyRechargeInput {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  transaction_id: string;
}

export interface VerifyRechargeResponse {
  success: boolean;
  transaction_id: string;
  tokens_credited: number;
  new_balance: number;
  package_name: string;
  message: string;
}

// ============ RECHARGE FUNCTIONS ============

/**
 * Get package by ID
 */
async function getPackageById(packageId: string): Promise<brandWalletService.Package | null> {
  const pkg = await db('packages')
    .where('id', packageId)
    .where('is_active', true)
    .first();
  
  return pkg || null;
}

/**
 * Get brand with user details for prefill
 */
async function getBrandDetails(brandId: string): Promise<{
  name: string;
  email: string;
  phone: string;
} | null> {
  const brand = await db('brands')
    .where('id', brandId)
    .select('name', 'contact_email as email', 'contact_phone as phone')
    .first();
  
  return brand || null;
}

/**
 * Initiate wallet recharge - Create Razorpay order
 */
export async function initiateRecharge(input: InitiateRechargeInput): Promise<InitiateRechargeResponse> {
  const { package_id, brand_id, user_id } = input;

  // Step 1: Validate package
  const pkg = await getPackageById(package_id);
  if (!pkg) {
    throw new Error('Package not found or inactive');
  }

  if (pkg.user_type !== 'brand') {
    throw new Error('Invalid package type. Please select a brand package.');
  }

  if (pkg.price <= 0) {
    throw new Error('This is a free package and cannot be purchased.');
  }

  // Step 2: Check if brand wallet exists
  const wallet = await brandWalletService.getBrandWalletByBrandId(brand_id);
  if (!wallet) {
    throw new Error('Brand wallet not found. Please complete your profile setup.');
  }

  // Step 3: Get brand details for prefill
  const brandDetails = await getBrandDetails(brand_id);

  // Step 4: Generate unique receipt/transaction reference
  const timestamp = Date.now();
  const receipt = `recharge_${brand_id.substring(0, 8)}_${timestamp}`;

  // Step 5: Create Razorpay order
  const razorpayOrder = await razorpayService.createOrder({
    amount: Math.round(pkg.price * 100), // Convert to paise
    currency: pkg.currency || 'INR',
    receipt: receipt,
    notes: {
      brand_id,
      user_id,
      package_id: pkg.id,
      package_name: pkg.name,
      tokens: pkg.tokens_included,
      type: 'wallet_recharge',
    },
  });

  // Step 6: Create pending transaction in database
  // Ensure tokens_included is stored as a number in metadata
  const tokensIncluded = parseInt(pkg.tokens_included as any, 10) || 0;
  
  const [transaction] = await db('brand_transactions')
    .insert({
      brand_id,
      user_id,
      transaction_type: 'token_credit',
      amount: pkg.price,
      currency: pkg.currency || 'INR',
      currency_type: 'token',
      balance_after: (wallet.wallet.token_balance || 0), // Will be updated on verification
      reference_type: 'package',
      reference_id: pkg.id,
      payment_method: 'razorpay',
      payment_gateway_id: razorpayOrder.id, // Razorpay order_id
      status: 'pending',
      description: `Package purchase: ${pkg.display_name} (${tokensIncluded} tokens)`,
      metadata: JSON.stringify({
        package_id: pkg.id,
        package_name: pkg.name,
        package_display_name: pkg.display_name,
        package_type: pkg.package_type || 'subscription',  // Store package type for verification
        tokens_included: tokensIncluded,  // Ensure it's a number
        validity_days: pkg.validity_days,  // Store validity for subscription packages
        razorpay_order_id: razorpayOrder.id,
        receipt: receipt,
      }),
    })
    .returning('*');

  logger.info('[Recharge] Initiated wallet recharge', {
    brand_id,
    package_id: pkg.id,
    amount: pkg.price,
    razorpay_order_id: razorpayOrder.id,
    transaction_id: transaction.id,
  });

  return {
    order_id: razorpayOrder.id,
    razorpay_key_id: razorpayService.getKeyId(),
    amount: Math.round(pkg.price * 100), // in paise for frontend
    currency: pkg.currency || 'INR',
    transaction_id: transaction.id,
    package: {
      id: pkg.id,
      name: pkg.name,
      display_name: pkg.display_name,
      tokens_included: tokensIncluded,  // Use the parsed number
      price: pkg.price,
    },
    prefill: brandDetails ? {
      name: brandDetails.name,
      email: brandDetails.email,
      contact: brandDetails.phone,
    } : undefined,
  };
}

/**
 * Verify payment and credit tokens
 */
export async function verifyRecharge(input: VerifyRechargeInput): Promise<VerifyRechargeResponse> {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, transaction_id } = input;

  // Step 1: Find the pending transaction
  const transaction = await db('brand_transactions')
    .where('id', transaction_id)
    .where('payment_gateway_id', razorpay_order_id)
    .where('status', 'pending')
    .first();

  if (!transaction) {
    throw new Error('Transaction not found or already processed');
  }

  // Step 2: Verify Razorpay signature
  const isValid = razorpayService.verifyPaymentSignature({
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  });

  if (!isValid) {
    // Update transaction as failed
    await db('brand_transactions')
      .where('id', transaction_id)
      .update({
        status: 'failed',
        failure_reason: 'Invalid payment signature',
        metadata: db.raw(`metadata || ?::jsonb`, [JSON.stringify({
          razorpay_payment_id,
          verification_failed: true,
          failed_at: new Date().toISOString(),
        })]),
      });

    logger.error('[Recharge] Payment verification failed - invalid signature', {
      transaction_id,
      razorpay_order_id,
      razorpay_payment_id,
    });

    // Send failure notification to brand
    notifyBrandDiamondPurchaseFailed(
      transaction.user_id,
      parseFloat(transaction.amount),
      'Payment verification failed. Please contact support if amount was deducted.'
    ).catch(err => logger.error('[Recharge] Failed to send failure notification', { error: err.message }));

    throw new Error('Payment verification failed. Please contact support if amount was deducted.');
  }

  // Step 3: Parse metadata to get package details
  let metadata: any = {};
  try {
    metadata = typeof transaction.metadata === 'string' 
      ? JSON.parse(transaction.metadata) 
      : transaction.metadata || {};
  } catch (e) {
    metadata = {};
  }

  // Ensure tokensToCredit is a number (fix string concatenation bug)
  const tokensToCredit = parseInt(metadata.tokens_included, 10) || 0;
  const packageId = metadata.package_id;
  const packageName = metadata.package_name || 'unknown';
  const packageDisplayName = metadata.package_display_name || packageName;
  const packageType = metadata.package_type || 'subscription';  // Default to subscription for backward compatibility
  const validityDays = metadata.validity_days;

  if (tokensToCredit <= 0) {
    throw new Error('Invalid token amount in transaction');
  }

  // Step 4: Credit tokens to wallet using database transaction
  const trx = await db.transaction();

  try {
    // Get current wallet balance
    const wallet = await trx('brand_wallets')
      .where('brand_id', transaction.brand_id)
      .first();

    if (!wallet) {
      throw new Error('Brand wallet not found');
    }

    const currentBalance = parseFloat(wallet.token_balance) || 0;
    const newBalance = currentBalance + tokensToCredit;

    // Build wallet update based on package type
    // Subscription packages: Update current_package, package_activated_at, package_expires_at
    // Topup packages: Only credit tokens, don't change package mapping
    const walletUpdate: any = {
      token_balance: newBalance,
      total_tokens_credited: trx.raw('total_tokens_credited + ?', [tokensToCredit]),
      last_transaction_at: new Date(),
      updated_at: new Date(),
    };

    // Only update package mapping for subscription packages
    if (packageType === 'subscription') {
      walletUpdate.current_package = packageName;
      walletUpdate.current_package_id = packageId;
      walletUpdate.package_activated_at = new Date();
      walletUpdate.package_expires_at = validityDays 
        ? new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000)
        : null;
      
      logger.info('[Recharge] Subscription package - updating wallet package mapping', {
        transaction_id,
        brand_id: transaction.brand_id,
        package_name: packageName,
        validity_days: validityDays,
      });
    } else {
      logger.info('[Recharge] Topup package - only crediting tokens, no package mapping', {
        transaction_id,
        brand_id: transaction.brand_id,
        tokens_credited: tokensToCredit,
      });
    }

    // Update wallet balance
    await trx('brand_wallets')
      .where('brand_id', transaction.brand_id)
      .update(walletUpdate);

    // Update transaction as completed
    await trx('brand_transactions')
      .where('id', transaction_id)
      .update({
        status: 'completed',
        balance_after: newBalance,
        processed_at: new Date(),
        metadata: trx.raw(`metadata || ?::jsonb`, [JSON.stringify({
          razorpay_payment_id,
          verified_at: new Date().toISOString(),
          tokens_credited: tokensToCredit,
          new_balance: newBalance,
        })]),
      });

    await trx.commit();

    logger.info('[Recharge] Payment verified and tokens credited', {
      transaction_id,
      brand_id: transaction.brand_id,
      razorpay_payment_id,
      tokens_credited: tokensToCredit,
      new_balance: newBalance,
    });

    // Generate invoice for the successful purchase
    // try {
    //   const brand = await db('brands').where('id', transaction.brand_id).first();
      
    //   const invoiceResult = await generateBrandPurchaseInvoice({
    //     transaction_id,
    //     brand_id: transaction.brand_id,
    //     amount: parseFloat(transaction.amount),
    //     brand: {
    //       name: brand?.name || brand?.company_name || 'Brand',
    //       address: brand?.address,
    //       pan: brand?.pan_number,
    //       gst_number: brand?.gst_number,
    //       state: brand?.state,
    //       state_code: brand?.state_code,
    //     },
    //     package_name: packageDisplayName,
    //     tokens: tokensToCredit,
    //     package_type: packageType,
    //   });
      
    //   logger.info('[Recharge] Invoice generated successfully', {
    //     transaction_id,
    //     invoice_number: invoiceResult.invoice_number,
    //   });
    // } catch (invoiceError: any) {
    //   // Don't fail the transaction if invoice generation fails
    //   logger.error('[Recharge] Failed to generate invoice', {
    //     transaction_id,
    //     error: invoiceError.message,
    //   });
    // }

    // Send success notification to brand
    notifyBrandDiamondPurchaseSuccess(
      transaction.user_id,
      parseFloat(transaction.amount),
      tokensToCredit,
      newBalance,
      packageDisplayName
    ).catch(err => logger.error('[Recharge] Failed to send success notification', { error: err.message }));

    // Notify admin for high-value transactions (e.g., > ₹10,000)
    if (parseFloat(transaction.amount) >= 10000) {
      const brand = await db('brands').where('id', transaction.brand_id).first();
      notifyAdminHighValueTransaction(
        transaction.brand_id,
        brand?.name || 'Brand',
        parseFloat(transaction.amount),
        'token_purchase',
        transaction_id
      ).catch(err => logger.error('[Recharge] Failed to send admin notification', { error: err.message }));
    }

    return {
      success: true,
      transaction_id,
      tokens_credited: tokensToCredit,
      new_balance: newBalance,
      package_name: packageDisplayName,
      message: `Successfully credited ${tokensToCredit} tokens to your wallet`,
    };
  } catch (error: any) {
    await trx.rollback();
    
    // Mark transaction as failed
    await db('brand_transactions')
      .where('id', transaction_id)
      .update({
        status: 'failed',
        failure_reason: error.message,
        metadata: db.raw(`metadata || ?::jsonb`, [JSON.stringify({
          razorpay_payment_id,
          credit_failed: true,
          error: error.message,
          failed_at: new Date().toISOString(),
        })]),
      });

    logger.error('[Recharge] Failed to credit tokens', {
      transaction_id,
      error: error.message,
    });

    throw new Error('Payment successful but failed to credit tokens. Please contact support.');
  }
}

/**
 * Handle Razorpay webhook for payment.captured event
 * This is a backup in case frontend verification fails
 */
export async function handleWebhook(
  event: string, 
  payload: any,
  signature: string
): Promise<{ processed: boolean; message: string }> {
  // Verify webhook signature
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  
  if (webhookSecret) {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (signature !== expectedSignature) {
      logger.warn('[Webhook] Invalid webhook signature');
      return { processed: false, message: 'Invalid signature' };
    }
  }

  // Handle payment.captured event
  if (event === 'payment.captured') {
    const payment = payload.payment?.entity;
    if (!payment) {
      return { processed: false, message: 'No payment entity in payload' };
    }

    const orderId = payment.order_id;
    const paymentId = payment.id;

    // Find the pending transaction
    const transaction = await db('brand_transactions')
      .where('payment_gateway_id', orderId)
      .where('status', 'pending')
      .first();

    if (!transaction) {
      // Transaction might already be processed via frontend
      logger.info('[Webhook] Transaction not found or already processed', { orderId });
      return { processed: false, message: 'Transaction already processed' };
    }

    // Process the payment (similar to verifyRecharge but without signature verification)
    try {
      let metadata: any = {};
      try {
        metadata = typeof transaction.metadata === 'string' 
          ? JSON.parse(transaction.metadata) 
          : transaction.metadata || {};
      } catch (e) {
        metadata = {};
      }

      // Ensure tokensToCredit is a number (fix string concatenation bug)
      const tokensToCredit = parseInt(metadata.tokens_included, 10) || 0;
      const packageName = metadata.package_name || 'unknown';

      const trx = await db.transaction();

      try {
        const wallet = await trx('brand_wallets')
          .where('brand_id', transaction.brand_id)
          .first();

        if (!wallet) {
          throw new Error('Wallet not found');
        }

        const currentBalance = parseFloat(wallet.token_balance) || 0;
        const newBalance = currentBalance + tokensToCredit;

        await trx('brand_wallets')
          .where('brand_id', transaction.brand_id)
          .update({
            token_balance: newBalance,
            total_tokens_credited: trx.raw('total_tokens_credited + ?', [tokensToCredit]),
            current_package: packageName,
            package_activated_at: new Date(),
            last_transaction_at: new Date(),
            updated_at: new Date(),
          });

        await trx('brand_transactions')
          .where('id', transaction.id)
          .update({
            status: 'completed',
            balance_after: newBalance,
            processed_at: new Date(),
            metadata: trx.raw(`metadata || ?::jsonb`, [JSON.stringify({
              razorpay_payment_id: paymentId,
              processed_via: 'webhook',
              tokens_credited: tokensToCredit,
              new_balance: newBalance,
            })]),
          });

        await trx.commit();

        logger.info('[Webhook] Payment processed via webhook', {
          transaction_id: transaction.id,
          brand_id: transaction.brand_id,
          tokens_credited: tokensToCredit,
        });

        return { processed: true, message: 'Payment processed successfully' };
      } catch (error) {
        await trx.rollback();
        throw error;
      }
    } catch (error: any) {
      logger.error('[Webhook] Failed to process payment', {
        orderId,
        error: error.message,
      });
      return { processed: false, message: error.message };
    }
  }

  return { processed: false, message: 'Event not handled' };
}

/**
 * Get recharge history for a brand
 */
export async function getRechargeHistory(
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
    hasNext: boolean;
    hasPrev: boolean;
  };
}> {
  const offset = (page - 1) * limit;

  const [{ count }] = await db('brand_transactions')
    .where('brand_id', brandId)
    .where('transaction_type', 'token_credit')
    .where('reference_type', 'package')
    .count();

  const total = parseInt(count as string, 10);
  const totalPages = Math.ceil(total / limit);

  const transactions = await db('brand_transactions')
    .where('brand_id', brandId)
    .where('transaction_type', 'token_credit')
    .where('reference_type', 'package')
    .orderBy('created_at', 'desc')
    .offset(offset)
    .limit(limit);

  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    },
  };
}
