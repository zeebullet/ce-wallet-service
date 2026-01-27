import db from '../db';
import { logger } from '../utils/logger';

// ============ INTERFACES ============

export interface BrandWallet {
  id: string;
  brand_id: string;
  user_id: string;
  token_balance: number;
  total_tokens_credited: number;
  total_tokens_debited: number;
  escrow_balance: number;
  escrow_on_hold: number;
  total_escrow_deposited: number;
  total_escrow_released: number;
  total_escrow_refunded: number;
  current_package: string;
  package_activated_at: Date | null;
  package_expires_at: Date | null;
  last_transaction_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface BrandTransaction {
  id: string;
  brand_id: string;
  user_id: string;
  transaction_type: string;
  amount: number;
  currency: string;
  currency_type: 'token' | 'escrow';
  balance_after: number;
  reference_type: string | null;
  reference_id: string | null;
  payment_method: string | null;
  payment_gateway_id: string | null;
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  description: string | null;
  metadata: any;
  failure_reason: string | null;
  processed_at: Date | null;
  created_at: Date;
}

export interface Package {
  id: string;
  user_type: string;
  package_type: 'subscription' | 'topup';
  name: string;
  display_name: string;
  description: string | null;
  tokens_included: number;
  price: number;
  currency: string;
  campaign_token_cost: number;
  report_token_cost: number;
  validity_days: number | null;
  features: any[];
  is_active: boolean;
  sort_order: number;
}

export interface BrandWalletResponse {
  wallet: BrandWallet;
  package: Package | null;
  stats: {
    token_balance: number;
    escrow_balance: number;
    escrow_on_hold: number;
    available_escrow: number;
    total_tokens_used: number;
    package_days_remaining: number | null;
    is_package_expired: boolean;
  };
}

// ============ HELPER FUNCTIONS ============

/**
 * Get free package for brands (price = 0)
 */
export async function getFreeBrandPackage(): Promise<Package | null> {
  const pkg = await db('packages')
    .where('user_type', 'brand')
    .where('price', 0)
    .where('is_active', true)
    .orderBy('sort_order', 'asc')
    .first();
  
  return pkg || null;
}

/**
 * Get package by name and user type
 */
export async function getPackageByName(userType: string, name: string): Promise<Package | null> {
  const pkg = await db('packages')
    .where('user_type', userType)
    .where('name', name)
    .where('is_active', true)
    .first();
  
  return pkg || null;
}

/**
 * Get brand by user_id
 */
async function getBrandByUserId(userId: string): Promise<{ id: string; name: string } | null> {
  const brand = await db('brands')
    .where('user_id', userId)
    .select('id', 'name')
    .first();
  
  return brand || null;
}

/**
 * Calculate package days remaining
 */
function calculatePackageDaysRemaining(expiresAt: Date | null): number | null {
  if (!expiresAt) return null;
  
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffTime = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 0 ? diffDays : 0;
}

// ============ MAIN FUNCTIONS ============

/**
 * Get or create brand wallet for a user
 * - First checks if user is linked to a brand
 * - If brand exists, get/create wallet with free package
 */
export async function getOrCreateBrandWallet(userId: string): Promise<BrandWalletResponse> {
  // Step 1: Get brand linked to this user
  const brand = await getBrandByUserId(userId);
  
  if (!brand) {
    throw new Error('No brand linked to this user. Please complete brand registration first.');
  }

  const brandId = brand.id;

  // Step 2: Check if wallet exists
  let wallet = await db('brand_wallets')
    .where('brand_id', brandId)
    .first();

  // Step 3: If no wallet exists, create one with free package
  if (!wallet) {
    logger.info(`[BrandWallet] Creating new wallet for brand ${brandId} (user: ${userId})`);
    
    // Get free package
    const freePackage = await getFreeBrandPackage();
    
    // Calculate package expiry
    let packageExpiresAt: Date | null = null;
    if (freePackage && freePackage.validity_days) {
      packageExpiresAt = new Date();
      packageExpiresAt.setDate(packageExpiresAt.getDate() + freePackage.validity_days);
    }

    // Use transaction for atomicity
    const trx = await db.transaction();

    try {
      // Create wallet
      const [newWallet] = await trx('brand_wallets')
        .insert({
          brand_id: brandId,
          user_id: userId,
          token_balance: freePackage ? freePackage.tokens_included : 0,
          total_tokens_credited: freePackage ? freePackage.tokens_included : 0,
          total_tokens_debited: 0,
          escrow_balance: 0,
          escrow_on_hold: 0,
          total_escrow_deposited: 0,
          total_escrow_released: 0,
          total_escrow_refunded: 0,
          current_package: freePackage ? freePackage.name : 'none',
          package_activated_at: freePackage ? new Date() : null,
          package_expires_at: packageExpiresAt,
          last_transaction_at: freePackage ? new Date() : null,
        })
        .returning('*');

      // If package has tokens, create transaction record
      if (freePackage && freePackage.tokens_included > 0) {
        await trx('brand_transactions').insert({
          brand_id: brandId,
          user_id: userId,
          transaction_type: 'token_credit',
          amount: freePackage.tokens_included,
          currency: 'INR',
          currency_type: 'token',
          balance_after: freePackage.tokens_included,
          reference_type: 'package',
          reference_id: freePackage.id,
          status: 'completed',
          description: `Welcome tokens from ${freePackage.display_name}`,
          metadata: JSON.stringify({
            package_name: freePackage.name,
            package_display_name: freePackage.display_name,
            tokens_included: freePackage.tokens_included,
            source: 'first_time_wallet_creation',
          }),
          processed_at: new Date(),
        });
      }

      await trx.commit();
      wallet = newWallet;

      logger.info(`[BrandWallet] Wallet created successfully for brand ${brandId}`, {
        wallet_id: wallet.id,
        package: freePackage?.name || 'none',
        initial_tokens: freePackage?.tokens_included || 0,
      });
    } catch (error: any) {
      await trx.rollback();
      
      // Check for unique constraint violation (race condition)
      if (error.code === '23505') {
        // Wallet was created by another request, fetch it
        wallet = await db('brand_wallets')
          .where('brand_id', brandId)
          .first();
        
        if (!wallet) {
          throw new Error('Failed to create or fetch brand wallet');
        }
        
        logger.info(`[BrandWallet] Wallet already exists for brand ${brandId}, fetched existing`);
      } else {
        throw error;
      }
    }
  }

  // Step 4: Get current package details
  let pkg: Package | null = null;
  if (wallet.current_package && wallet.current_package !== 'none') {
    pkg = await getPackageByName('brand', wallet.current_package);
  }

  // Step 5: Calculate stats
  const daysRemaining = calculatePackageDaysRemaining(wallet.package_expires_at);
  const isExpired = daysRemaining !== null && daysRemaining <= 0;

  // Parse numeric values properly
  const tokenBalance = parseFloat(wallet.token_balance) || 0;
  const escrowBalance = parseFloat(wallet.escrow_balance) || 0;
  const escrowOnHold = parseFloat(wallet.escrow_on_hold) || 0;
  const totalDebited = parseFloat(wallet.total_tokens_debited) || 0;

  return {
    wallet: {
      ...wallet,
      token_balance: tokenBalance,
      total_tokens_credited: parseFloat(wallet.total_tokens_credited) || 0,
      total_tokens_debited: totalDebited,
      escrow_balance: escrowBalance,
      escrow_on_hold: escrowOnHold,
      total_escrow_deposited: parseFloat(wallet.total_escrow_deposited) || 0,
      total_escrow_released: parseFloat(wallet.total_escrow_released) || 0,
      total_escrow_refunded: parseFloat(wallet.total_escrow_refunded) || 0,
    },
    package: pkg,
    stats: {
      token_balance: tokenBalance,
      escrow_balance: escrowBalance,
      escrow_on_hold: escrowOnHold,
      available_escrow: escrowBalance - escrowOnHold,
      total_tokens_used: totalDebited,
      package_days_remaining: daysRemaining,
      is_package_expired: isExpired,
    },
  };
}

/**
 * Get brand wallet by brand ID (without auto-creation)
 */
export async function getBrandWalletByBrandId(brandId: string): Promise<BrandWalletResponse | null> {
  const wallet = await db('brand_wallets')
    .where('brand_id', brandId)
    .first();
  
  if (!wallet) {
    return null;
  }

  // Get current package details
  let pkg: Package | null = null;
  if (wallet.current_package && wallet.current_package !== 'none') {
    pkg = await getPackageByName('brand', wallet.current_package);
  }

  // Calculate stats
  const daysRemaining = calculatePackageDaysRemaining(wallet.package_expires_at);
  const isExpired = daysRemaining !== null && daysRemaining <= 0;

  const tokenBalance = parseFloat(wallet.token_balance) || 0;
  const escrowBalance = parseFloat(wallet.escrow_balance) || 0;
  const escrowOnHold = parseFloat(wallet.escrow_on_hold) || 0;
  const totalDebited = parseFloat(wallet.total_tokens_debited) || 0;

  return {
    wallet: {
      ...wallet,
      token_balance: tokenBalance,
      total_tokens_credited: parseFloat(wallet.total_tokens_credited) || 0,
      total_tokens_debited: totalDebited,
      escrow_balance: escrowBalance,
      escrow_on_hold: escrowOnHold,
      total_escrow_deposited: parseFloat(wallet.total_escrow_deposited) || 0,
      total_escrow_released: parseFloat(wallet.total_escrow_released) || 0,
      total_escrow_refunded: parseFloat(wallet.total_escrow_refunded) || 0,
    },
    package: pkg,
    stats: {
      token_balance: tokenBalance,
      escrow_balance: escrowBalance,
      escrow_on_hold: escrowOnHold,
      available_escrow: escrowBalance - escrowOnHold,
      total_tokens_used: totalDebited,
      package_days_remaining: daysRemaining,
      is_package_expired: isExpired,
    },
  };
}

/**
 * Get brand wallet transactions
 */
export async function getBrandTransactions(
  brandId: string,
  options: {
    page?: number;
    limit?: number;
    type?: string;
    currency_type?: 'token' | 'escrow';
    status?: string;
  } = {}
): Promise<{
  transactions: BrandTransaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}> {
  const { page = 1, limit = 20, type, currency_type, status } = options;
  const offset = (page - 1) * limit;

  // Build query
  let query = db('brand_transactions')
    .where('brand_id', brandId);

  if (type) {
    query = query.where('transaction_type', type);
  }

  if (currency_type) {
    query = query.where('currency_type', currency_type);
  }

  if (status) {
    query = query.where('status', status);
  }

  // Get total count
  const [{ count }] = await query.clone().count();
  const total = parseInt(count as string, 10);

  // Get transactions
  const transactions = await query
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);

  const totalPages = Math.ceil(total / limit);

  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * Get available brand packages
 */
export async function getAvailableBrandPackages(): Promise<Package[]> {
  const packages = await db('packages')
    .where('user_type', 'brand')
    .where('is_active', true)
    .orderBy('sort_order', 'asc');
  
  return packages;
}

/**
 * Check if user has sufficient tokens
 */
export async function hasEnoughTokens(userId: string, requiredTokens: {
  campaign_token_cost: number;
  report_token_cost: number;
} | null): Promise<{
    has_enough_tokens_for_search: boolean;
    required_tokens_for_search: number;
    has_enough_tokens_for_campaign: boolean;
    required_tokens_for_campaign: number;
}> {
  const campaign_token_cost = requiredTokens?.campaign_token_cost || 0;
  const report_token_cost = requiredTokens?.report_token_cost || 0;

  const brand = await getBrandByUserId(userId);
  
  if (!brand) {
    throw new Error('No brand linked to this user. Please complete brand registration first.');
  }

  const wallet = await db('brand_wallets')
    .where('brand_id', brand.id)
    .first();

  if (!wallet) {
    throw new Error('No wallet found for this brand.');
  }

  const balance = parseFloat(wallet.token_balance) || 0;
  const has_enough_tokens_for_search = balance >= report_token_cost;
  const has_enough_tokens_for_campaign = balance >= campaign_token_cost;

  return {
    has_enough_tokens_for_search,
    required_tokens_for_search: has_enough_tokens_for_search ? 0 : (report_token_cost-balance),
    has_enough_tokens_for_campaign,
    required_tokens_for_campaign: has_enough_tokens_for_campaign ? 0 : (campaign_token_cost-balance),
  };
}

/**
 * Get token costs from current package
 */
export async function getTokenCosts(userId: string): Promise<{
  campaign_token_cost: number;
  report_token_cost: number;
} | null> {
  const brand = await getBrandByUserId(userId);
  
  if (!brand) {
    return null;
  }

  const wallet = await db('brand_wallets')
    .where('brand_id', brand.id)
    .first();

  if (!wallet || !wallet.current_package || wallet.current_package === 'none') {
    return null;
  }

  const pkg = await getPackageByName('brand', wallet.current_package);
  
  if (!pkg) {
    return null;
  }

  return {
    campaign_token_cost: parseFloat(pkg.campaign_token_cost as any) || 1,
    report_token_cost: parseFloat(pkg.report_token_cost as any) || 1,
  };
}
