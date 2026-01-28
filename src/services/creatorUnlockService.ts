import db from '../db';
import { logger } from '../utils/logger';
import * as brandWalletService from './brandWalletService';

// ============ INTERFACES ============

export interface UnlockCreatorInput {
  brand_user_id: string;  // The brand user performing the unlock
  creator_id: string;     // The creator to unlock
}

export interface UnlockCreatorResult {
  success: boolean;
  unlock_id: string;
  creator_id: string;
  tokens_spent: number;
  remaining_token_balance: number;
  unlocked_at: Date;
}

export interface BulkUnlockCreatorInput {
  brand_user_id: string;
  creator_ids: string[];
}

export interface BulkUnlockResult {
  success: boolean;
  total_requested: number;
  total_unlocked: number;
  total_tokens_spent: number;
  remaining_token_balance: number;
  unlocked: Array<{
    creator_id: string;
    unlock_id: string;
    tokens_spent: number;
  }>;
  skipped: Array<{
    creator_id: string;
    reason: string;
  }>;
  failed: Array<{
    creator_id: string;
    reason: string;
  }>;
}

export interface UnlockedCreator {
  id: string;
  brand_id: string;
  creator_id: string;
  unlocked_by_user_id: string;
  transaction_id: string | null;
  tokens_spent: number;
  package_id: string | null;
  package_name: string | null;
  unlocked_at: Date;
  creator?: {
    id: string;
    username: string;
    display_name: string;
    profile_picture_url: string | null;
    // Add more creator fields as needed
  };
}

// ============ MAIN FUNCTIONS ============

/**
 * Check if a brand has already unlocked a creator
 */
export async function isCreatorUnlocked(brandId: string, creatorId: string): Promise<boolean> {
  const existing = await db('brand_unlocked_creators')
    .where('brand_id', brandId)
    .where('creator_id', creatorId)
    .first();
  
  return !!existing;
}

/**
 * Get the report token cost for a brand based on their active package
 */
export async function getReportTokenCost(brandUserId: string): Promise<number> {
  // Get brand wallet with package info
  const walletData = await brandWalletService.getOrCreateBrandWallet(brandUserId);
  
  if (!walletData.package) {
    throw new Error('No active package found for brand');
  }
  
  return parseFloat(walletData.package.report_token_cost.toString()) || 5; // Default to 5 if not set
}

/**
 * Unlock a creator profile for a brand
 * Deducts tokens based on report_token_cost from the brand's active package
 */
export async function unlockCreator(input: UnlockCreatorInput): Promise<UnlockCreatorResult> {
  const { brand_user_id, creator_id } = input;
  
  logger.info('[CreatorUnlock] Starting unlock process', { brand_user_id, creator_id });
  
  // Start transaction
  const trx = await db.transaction();
  
  try {
    // 1. Get brand wallet and package info
    const walletData = await brandWalletService.getOrCreateBrandWallet(brand_user_id);
    const brandId = walletData.wallet.brand_id;
    const tokenBalance = parseFloat(walletData.wallet.token_balance.toString());
    
    if (!walletData.package) {
      throw new Error('No active package found for brand');
    }
    
    const reportTokenCost = parseFloat(walletData.package.report_token_cost.toString()) || 5;
    
    // 2. Check if already unlocked
    const alreadyUnlocked = await trx('brand_unlocked_creators')
      .where('brand_id', brandId)
      .where('creator_id', creator_id)
      .first();
    
    if (alreadyUnlocked) {
      await trx.rollback();
      throw new Error('Creator profile is already unlocked');
    }
    
    // 3. Check if creator exists
    const creator = await trx('ce_users')
      .where('id', creator_id)
      .first();
    
    if (!creator) {
      await trx.rollback();
      throw new Error('Creator not found');
    }
    
    // 4. Check if brand has enough tokens
    if (tokenBalance < reportTokenCost) {
      await trx.rollback();
      throw new Error(`Insufficient token balance. Required: ${reportTokenCost}, Available: ${tokenBalance}`);
    }
    
    // 5. Deduct tokens from brand wallet
    const newTokenBalance = tokenBalance - reportTokenCost;
    
    await trx('brand_wallets')
      .where('brand_id', brandId)
      .update({
        token_balance: newTokenBalance,
        total_tokens_debited: trx.raw('total_tokens_debited + ?', [reportTokenCost]),
        last_transaction_at: trx.fn.now(),
        updated_at: trx.fn.now(),
      });
    
    // 6. Create transaction record
    const [transaction] = await trx('brand_transactions')
      .insert({
        brand_id: brandId,
        user_id: brand_user_id,
        transaction_type: 'creator_unlock',
        amount: reportTokenCost,
        currency: 'TOKEN',
        currency_type: 'token',
        balance_after: newTokenBalance,
        reference_type: 'creator_unlock',
        reference_id: creator_id,
        status: 'completed',
        description: `Unlocked creator profile: ${creator.username || creator.id}`,
        metadata: {
          creator_id: creator_id,
          creator_username: creator.username,
          package_id: walletData.package.id,
          package_name: walletData.package.name,
          report_token_cost: reportTokenCost,
        },
        processed_at: trx.fn.now(),
      })
      .returning('*');
    
    // 7. Create unlock record
    const [unlockRecord] = await trx('brand_unlocked_creators')
      .insert({
        brand_id: brandId,
        creator_id: creator_id,
        unlocked_by_user_id: brand_user_id,
        transaction_id: transaction.id,
        tokens_spent: reportTokenCost,
        package_id: walletData.package.id,
        package_name: walletData.package.name,
        unlocked_at: trx.fn.now(),
      })
      .returning('*');
    
    // Commit transaction
    await trx.commit();
    
    logger.info('[CreatorUnlock] Successfully unlocked creator', {
      unlock_id: unlockRecord.id,
      brand_id: brandId,
      creator_id: creator_id,
      tokens_spent: reportTokenCost,
      remaining_balance: newTokenBalance,
    });
    
    return {
      success: true,
      unlock_id: unlockRecord.id,
      creator_id: creator_id,
      tokens_spent: reportTokenCost,
      remaining_token_balance: newTokenBalance,
      unlocked_at: unlockRecord.unlocked_at,
    };
    
  } catch (error: any) {
    await trx.rollback();
    logger.error('[CreatorUnlock] Failed to unlock creator', {
      brand_user_id,
      creator_id,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get all creators unlocked by a brand
 */
export async function getUnlockedCreators(
  brandUserId: string,
  options: { page?: number; limit?: number } = {}
): Promise<{ unlocked_creators: UnlockedCreator[]; total: number; page: number; limit: number }> {
  const { page = 1, limit = 20 } = options;
  const offset = (page - 1) * limit;
  
  // Get brand wallet to get brand_id
  const walletData = await brandWalletService.getOrCreateBrandWallet(brandUserId);
  const brandId = walletData.wallet.brand_id;
  
  // Get total count
  const [{ count }] = await db('brand_unlocked_creators')
    .where('brand_id', brandId)
    .count('id as count');
  
  // Get unlocked creators with creator info
  const unlockedCreators = await db('brand_unlocked_creators as buc')
    .leftJoin('ce_users as u', 'buc.creator_id', 'u.id')
    .where('buc.brand_id', brandId)
    .select(
      'buc.id',
      'buc.brand_id',
      'buc.creator_id',
      'buc.unlocked_by_user_id',
      'buc.transaction_id',
      'buc.tokens_spent',
      'buc.package_id',
      'buc.package_name',
      'buc.unlocked_at',
      'u.username as creator_username',
      'u.display_name as creator_display_name',
      'u.profile_picture_url as creator_profile_picture'
    )
    .orderBy('buc.unlocked_at', 'desc')
    .limit(limit)
    .offset(offset);
  
  // Format response
  const formattedCreators = unlockedCreators.map((uc: any) => ({
    id: uc.id,
    brand_id: uc.brand_id,
    creator_id: uc.creator_id,
    unlocked_by_user_id: uc.unlocked_by_user_id,
    transaction_id: uc.transaction_id,
    tokens_spent: parseFloat(uc.tokens_spent),
    package_id: uc.package_id,
    package_name: uc.package_name,
    unlocked_at: uc.unlocked_at,
    creator: {
      id: uc.creator_id,
      username: uc.creator_username,
      display_name: uc.creator_display_name,
      profile_picture_url: uc.creator_profile_picture,
    },
  }));
  
  return {
    unlocked_creators: formattedCreators,
    total: parseInt(count as string),
    page,
    limit,
  };
}

/**
 * Check if a brand has unlocked specific creators (bulk check)
 */
export async function checkUnlockedCreators(
  brandUserId: string,
  creatorIds: string[]
): Promise<{ [creatorId: string]: boolean }> {
  if (creatorIds.length === 0) {
    return {};
  }
  
  // Get brand wallet to get brand_id
  const walletData = await brandWalletService.getOrCreateBrandWallet(brandUserId);
  const brandId = walletData.wallet.brand_id;
  
  // Get all unlocked creators from the list
  const unlockedRecords = await db('brand_unlocked_creators')
    .where('brand_id', brandId)
    .whereIn('creator_id', creatorIds)
    .select('creator_id');
  
  const unlockedSet = new Set(unlockedRecords.map((r: any) => r.creator_id));
  
  // Build result map
  const result: { [creatorId: string]: boolean } = {};
  for (const creatorId of creatorIds) {
    result[creatorId] = unlockedSet.has(creatorId);
  }
  
  return result;
}

/**
 * Get unlock cost for a brand (preview before unlocking)
 */
export async function getUnlockCost(brandUserId: string): Promise<{
  token_cost: number;
  current_balance: number;
  can_unlock: boolean;
}> {
  const walletData = await brandWalletService.getOrCreateBrandWallet(brandUserId);
  
  if (!walletData.package) {
    throw new Error('No active package found for brand');
  }
  
  const tokenCost = parseFloat(walletData.package.report_token_cost.toString()) || 5;
  const currentBalance = parseFloat(walletData.wallet.token_balance.toString());
  
  return {
    token_cost: tokenCost,
    current_balance: currentBalance,
    can_unlock: currentBalance >= tokenCost,
  };
}

/**
 * Bulk unlock multiple creator profiles
 * Deducts tokens for each creator based on report_token_cost
 * Continues unlocking until tokens run out or all creators are processed
 */
export async function bulkUnlockCreators(input: BulkUnlockCreatorInput): Promise<BulkUnlockResult> {
  const { brand_user_id, creator_ids } = input;
  
  logger.info('[CreatorUnlock] Starting bulk unlock process', { 
    brand_user_id, 
    creator_count: creator_ids.length 
  });
  
  // Remove duplicates
  const uniqueCreatorIds = [...new Set(creator_ids)];
  
  const result: BulkUnlockResult = {
    success: true,
    total_requested: uniqueCreatorIds.length,
    total_unlocked: 0,
    total_tokens_spent: 0,
    remaining_token_balance: 0,
    unlocked: [],
    skipped: [],
    failed: [],
  };
  
  // Start transaction
  const trx = await db.transaction();
  
  try {
    // 1. Get brand wallet and package info
    const walletData = await brandWalletService.getOrCreateBrandWallet(brand_user_id);
    const brandId = walletData.wallet.brand_id;
    let tokenBalance = parseFloat(walletData.wallet.token_balance.toString());
    
    if (!walletData.package) {
      throw new Error('No active package found for brand');
    }
    
    const reportTokenCost = parseFloat(walletData.package.report_token_cost.toString()) || 5;
    const packageId = walletData.package.id;
    const packageName = walletData.package.name;
    
    // 2. Get already unlocked creators
    const alreadyUnlocked = await trx('brand_unlocked_creators')
      .where('brand_id', brandId)
      .whereIn('creator_id', uniqueCreatorIds)
      .select('creator_id');
    
    const alreadyUnlockedSet = new Set(alreadyUnlocked.map((r: any) => r.creator_id));
    
    // 3. Verify which creators exist
    const existingCreators = await trx('ce_users')
      .whereIn('id', uniqueCreatorIds)
      .select('id', 'username');
    
    const existingCreatorMap = new Map(existingCreators.map((c: any) => [c.id, c]));
    
    // 4. Process each creator
    for (const creatorId of uniqueCreatorIds) {
      // Check if already unlocked
      if (alreadyUnlockedSet.has(creatorId)) {
        result.skipped.push({
          creator_id: creatorId,
          reason: 'Already unlocked',
        });
        continue;
      }
      
      // Check if creator exists
      const creator = existingCreatorMap.get(creatorId);
      if (!creator) {
        result.failed.push({
          creator_id: creatorId,
          reason: 'Creator not found',
        });
        continue;
      }
      
      // Check if enough tokens
      if (tokenBalance < reportTokenCost) {
        result.failed.push({
          creator_id: creatorId,
          reason: 'Insufficient token balance',
        });
        continue;
      }
      
      // Deduct tokens
      tokenBalance -= reportTokenCost;
      
      // Create transaction record
      const [transaction] = await trx('brand_transactions')
        .insert({
          brand_id: brandId,
          user_id: brand_user_id,
          transaction_type: 'creator_unlock',
          amount: reportTokenCost,
          currency: 'TOKEN',
          currency_type: 'token',
          balance_after: tokenBalance,
          reference_type: 'creator_unlock',
          reference_id: creatorId,
          status: 'completed',
          description: `Unlocked creator profile: ${creator.username || creatorId}`,
          metadata: {
            creator_id: creatorId,
            creator_username: creator.username,
            package_id: packageId,
            package_name: packageName,
            report_token_cost: reportTokenCost,
            bulk_unlock: true,
          },
          processed_at: trx.fn.now(),
        })
        .returning('*');
      
      // Create unlock record
      const [unlockRecord] = await trx('brand_unlocked_creators')
        .insert({
          brand_id: brandId,
          creator_id: creatorId,
          unlocked_by_user_id: brand_user_id,
          transaction_id: transaction.id,
          tokens_spent: reportTokenCost,
          package_id: packageId,
          package_name: packageName,
          unlocked_at: trx.fn.now(),
        })
        .returning('*');
      
      result.unlocked.push({
        creator_id: creatorId,
        unlock_id: unlockRecord.id,
        tokens_spent: reportTokenCost,
      });
      
      result.total_unlocked++;
      result.total_tokens_spent += reportTokenCost;
    }
    
    // 5. Update brand wallet with final balance
    if (result.total_unlocked > 0) {
      await trx('brand_wallets')
        .where('brand_id', brandId)
        .update({
          token_balance: tokenBalance,
          total_tokens_debited: trx.raw('total_tokens_debited + ?', [result.total_tokens_spent]),
          last_transaction_at: trx.fn.now(),
          updated_at: trx.fn.now(),
        });
    }
    
    result.remaining_token_balance = tokenBalance;
    
    // Commit transaction
    await trx.commit();
    
    logger.info('[CreatorUnlock] Bulk unlock completed', {
      brand_id: brandId,
      total_requested: result.total_requested,
      total_unlocked: result.total_unlocked,
      total_skipped: result.skipped.length,
      total_failed: result.failed.length,
      total_tokens_spent: result.total_tokens_spent,
    });
    
    return result;
    
  } catch (error: any) {
    await trx.rollback();
    logger.error('[CreatorUnlock] Bulk unlock failed', {
      brand_user_id,
      creator_count: uniqueCreatorIds.length,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get bulk unlock cost preview
 */
export async function getBulkUnlockCost(
  brandUserId: string, 
  creatorIds: string[]
): Promise<{
  token_cost_per_creator: number;
  total_creators: number;
  already_unlocked: number;
  to_unlock: number;
  total_token_cost: number;
  current_balance: number;
  can_unlock_all: boolean;
  can_unlock_count: number;
}> {
  const walletData = await brandWalletService.getOrCreateBrandWallet(brandUserId);
  const brandId = walletData.wallet.brand_id;
  
  if (!walletData.package) {
    throw new Error('No active package found for brand');
  }
  
  const tokenCostPerCreator = parseFloat(walletData.package.report_token_cost.toString()) || 5;
  const currentBalance = parseFloat(walletData.wallet.token_balance.toString());
  
  // Remove duplicates
  const uniqueCreatorIds = [...new Set(creatorIds)];
  
  // Check already unlocked
  const alreadyUnlocked = await db('brand_unlocked_creators')
    .where('brand_id', brandId)
    .whereIn('creator_id', uniqueCreatorIds)
    .count('id as count')
    .first();
  
  const alreadyUnlockedCount = parseInt((alreadyUnlocked?.count as string) || '0');
  const toUnlockCount = uniqueCreatorIds.length - alreadyUnlockedCount;
  const totalTokenCost = toUnlockCount * tokenCostPerCreator;
  const canUnlockCount = Math.floor(currentBalance / tokenCostPerCreator);
  
  return {
    token_cost_per_creator: tokenCostPerCreator,
    total_creators: uniqueCreatorIds.length,
    already_unlocked: alreadyUnlockedCount,
    to_unlock: toUnlockCount,
    total_token_cost: totalTokenCost,
    current_balance: currentBalance,
    can_unlock_all: currentBalance >= totalTokenCost,
    can_unlock_count: Math.min(canUnlockCount, toUnlockCount),
  };
}
