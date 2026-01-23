import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

// Notification service base URL from environment
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL_GATEWAY || 'http://localhost:3009';

// Types
type RecipientType = 'creator' | 'brand' | 'admin';
type DeliveryChannel = 'in_app' | 'push' | 'sms' | 'email' | 'web';
type Priority = 'low' | 'normal' | 'high' | 'urgent';

// Brand notification types
type BrandNotificationType =
  | 'diamond_purchase_success'
  | 'diamond_purchase_failed'
  | 'token_escrow_success'
  | 'low_wallet_balance'
  | 'wallet_refund_issued';

// Admin notification types
type AdminNotificationType =
  | 'wallet_anomaly'
  | 'wallet_critical_imbalance'
  | 'token_conversion_threshold'
  | 'high_value_transaction';

interface SendNotificationParams {
  user_id: string;
  title: string;
  message?: string;
  notification_type: string;
  delivery_channel?: DeliveryChannel;
  recipient_type?: RecipientType;
  priority?: Priority;
  action_url?: string;
  metadata?: Record<string, any>;
}

interface BrandNotificationParams {
  brand_user_id: string;
  notification_type: BrandNotificationType;
  title: string;
  email_subject?: string;
  email_body?: string;
  web_body?: string;
  action_url?: string;
  priority?: Priority;
  metadata?: Record<string, any>;
  channels?: ('email' | 'web')[];
}

interface AdminNotificationParams {
  admin_user_id: string;
  notification_type: AdminNotificationType;
  title: string;
  email_subject?: string;
  email_body?: string;
  web_body?: string;
  action_url?: string;
  priority?: Priority;
  metadata?: Record<string, any>;
  channels?: ('email' | 'web')[];
}

// Create axios instance for notification service
const notificationClient: AxiosInstance = axios.create({
  baseURL: NOTIFICATION_SERVICE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Send a notification to a brand
 */
export async function sendBrandNotification(params: BrandNotificationParams): Promise<boolean> {
  try {
    const response = await notificationClient.post('/api/v1/notifications/brand', {
      brand_user_id: params.brand_user_id,
      notification_type: params.notification_type,
      title: params.title,
      email_subject: params.email_subject,
      email_body: params.email_body,
      web_body: params.web_body,
      action_url: params.action_url,
      priority: params.priority || 'normal',
      metadata: params.metadata,
      channels: params.channels || ['web'],
    });

    logger.info('Brand notification sent successfully', {
      brand_user_id: params.brand_user_id,
      notification_type: params.notification_type,
      response_status: response.status,
    });

    return true;
  } catch (error: any) {
    logger.error('Failed to send brand notification', {
      brand_user_id: params.brand_user_id,
      notification_type: params.notification_type,
      error: error.message,
    });
    return false;
  }
}

/**
 * Send a notification to admin(s)
 */
export async function sendAdminNotification(params: AdminNotificationParams): Promise<boolean> {
  try {
    const response = await notificationClient.post('/api/v1/notifications/admin', {
      admin_user_id: params.admin_user_id,
      notification_type: params.notification_type,
      title: params.title,
      email_subject: params.email_subject,
      email_body: params.email_body,
      web_body: params.web_body,
      action_url: params.action_url,
      priority: params.priority || 'normal',
      metadata: params.metadata,
      channels: params.channels || ['email', 'web'],
    });

    logger.info('Admin notification sent successfully', {
      admin_user_id: params.admin_user_id,
      notification_type: params.notification_type,
      response_status: response.status,
    });

    return true;
  } catch (error: any) {
    logger.error('Failed to send admin notification', {
      admin_user_id: params.admin_user_id,
      notification_type: params.notification_type,
      error: error.message,
    });
    return false;
  }
}

/**
 * Broadcast notification to all admins
 */
export async function broadcastToAdmins(params: Omit<AdminNotificationParams, 'admin_user_id'>): Promise<boolean> {
  try {
    const response = await notificationClient.post('/api/v1/notifications/admin/broadcast', {
      notification_type: params.notification_type,
      title: params.title,
      email_subject: params.email_subject,
      email_body: params.email_body,
      web_body: params.web_body,
      action_url: params.action_url,
      priority: params.priority || 'normal',
      metadata: params.metadata,
      channels: params.channels || ['email', 'web'],
    });

    logger.info('Admin broadcast sent successfully', {
      notification_type: params.notification_type,
      response_status: response.status,
    });

    return true;
  } catch (error: any) {
    logger.error('Failed to broadcast to admins', {
      notification_type: params.notification_type,
      error: error.message,
    });
    return false;
  }
}

// ============ BRAND WALLET NOTIFICATION HELPERS ============

/**
 * Notify brand when diamond/token purchase is successful
 */
export async function notifyBrandDiamondPurchaseSuccess(
  brandUserId: string,
  amount: number,
  tokensAdded: number,
  newBalance: number,
  packageName: string
): Promise<boolean> {
  return sendBrandNotification({
    brand_user_id: brandUserId,
    notification_type: 'diamond_purchase_success',
    title: `Wallet Loaded: ${tokensAdded} Tokens`,
    email_subject: `Payment Successful: ${tokensAdded} Tokens Added`,
    email_body: `Your payment of ₹${amount} was successful!\n\n${tokensAdded} tokens (${packageName}) have been added to your wallet.\n\nNew Balance: ${newBalance} tokens\n\nYou can now use these tokens to launch campaigns.`,
    web_body: `💎 ₹${amount} payment successful! ${tokensAdded} tokens added. Balance: ${newBalance}`,
    action_url: `/wallet`,
    priority: 'high',
    metadata: { amount, tokens_added: tokensAdded, new_balance: newBalance, package_name: packageName },
    channels: ['email', 'web'],
  });
}

/**
 * Notify brand when diamond/token purchase fails
 */
export async function notifyBrandDiamondPurchaseFailed(
  brandUserId: string,
  amount: number,
  reason?: string
): Promise<boolean> {
  return sendBrandNotification({
    brand_user_id: brandUserId,
    notification_type: 'diamond_purchase_failed',
    title: 'Payment Failed',
    email_subject: 'Payment Failed - Action Required',
    email_body: `Your payment of ₹${amount} could not be processed.\n\n${reason || 'Please try again with a different payment method.'}\n\nIf amount was deducted, it will be refunded within 5-7 business days.`,
    web_body: `⚠️ Payment of ₹${amount} failed. ${reason || 'Please retry'}`,
    action_url: `/wallet/recharge`,
    priority: 'high',
    metadata: { amount, reason },
    channels: ['email', 'web'],
  });
}

/**
 * Notify brand when tokens are escrowed for a campaign
 */
export async function notifyBrandTokenEscrowSuccess(
  brandUserId: string,
  tokensEscrowed: number,
  campaignTitle: string,
  campaignId: string,
  remainingBalance: number
): Promise<boolean> {
  return sendBrandNotification({
    brand_user_id: brandUserId,
    notification_type: 'token_escrow_success',
    title: `Tokens Reserved: ${campaignTitle}`,
    web_body: `🔒 ${tokensEscrowed} tokens reserved for "${campaignTitle}". Balance: ${remainingBalance}`,
    action_url: `/campaigns/${campaignId}`,
    priority: 'normal',
    metadata: { tokens_escrowed: tokensEscrowed, campaign_id: campaignId, campaign_title: campaignTitle, remaining_balance: remainingBalance },
    channels: ['web'],
  });
}

/**
 * Notify brand when wallet balance is low
 */
export async function notifyBrandLowWalletBalance(
  brandUserId: string,
  currentBalance: number,
  threshold: number = 100
): Promise<boolean> {
  return sendBrandNotification({
    brand_user_id: brandUserId,
    notification_type: 'low_wallet_balance',
    title: 'Low Wallet Balance',
    email_subject: 'Low Wallet Balance - Top Up Now',
    email_body: `Your wallet balance is running low.\n\nCurrent Balance: ${currentBalance} tokens\n\nTop up now to continue running campaigns without interruption.`,
    web_body: `⚠️ Low balance: ${currentBalance} tokens. Top up now`,
    action_url: `/wallet/recharge`,
    priority: 'normal',
    metadata: { current_balance: currentBalance, threshold },
    channels: ['email', 'web'],
  });
}

/**
 * Notify brand when refund is issued
 */
export async function notifyBrandWalletRefund(
  brandUserId: string,
  tokensRefunded: number,
  reason: string,
  campaignTitle?: string,
  campaignId?: string
): Promise<boolean> {
  return sendBrandNotification({
    brand_user_id: brandUserId,
    notification_type: 'wallet_refund_issued',
    title: `Refund: ${tokensRefunded} Tokens`,
    email_subject: `Refund Processed: ${tokensRefunded} Tokens`,
    email_body: `A refund of ${tokensRefunded} tokens has been credited to your wallet.\n\nReason: ${reason}${campaignTitle ? `\nCampaign: ${campaignTitle}` : ''}\n\nThe tokens are available immediately for use.`,
    web_body: `💰 Refund: ${tokensRefunded} tokens credited. ${reason}`,
    action_url: `/wallet`,
    priority: 'normal',
    metadata: { tokens_refunded: tokensRefunded, reason, campaign_id: campaignId, campaign_title: campaignTitle },
    channels: ['email', 'web'],
  });
}

// ============ ADMIN WALLET NOTIFICATION HELPERS ============

/**
 * Notify admins of wallet anomaly
 */
export async function notifyAdminWalletAnomaly(
  brandId: string,
  brandName: string,
  anomalyType: string,
  details: string
): Promise<boolean> {
  return broadcastToAdmins({
    notification_type: 'wallet_anomaly',
    title: `Wallet Anomaly: ${brandName}`,
    email_subject: `Wallet Anomaly Detected: ${brandName}`,
    email_body: `A wallet anomaly has been detected.\n\nBrand: ${brandName}\nType: ${anomalyType}\nDetails: ${details}\n\nPlease review immediately.`,
    web_body: `⚠️ Wallet anomaly: ${brandName} - ${anomalyType}`,
    action_url: `/admin/wallets/${brandId}`,
    priority: 'high',
    metadata: { brand_id: brandId, brand_name: brandName, anomaly_type: anomalyType, details },
    channels: ['email', 'web'],
  });
}

/**
 * Notify admins of high-value transaction
 */
export async function notifyAdminHighValueTransaction(
  brandId: string,
  brandName: string,
  amount: number,
  transactionType: string,
  transactionId: string
): Promise<boolean> {
  return broadcastToAdmins({
    notification_type: 'high_value_transaction',
    title: `High Value: ₹${amount} ${transactionType}`,
    email_subject: `High Value Transaction: ₹${amount}`,
    email_body: `A high-value transaction has been processed.\n\nBrand: ${brandName}\nType: ${transactionType}\nAmount: ₹${amount}\nTransaction ID: ${transactionId}`,
    web_body: `💰 High value: ₹${amount} ${transactionType} by ${brandName}`,
    action_url: `/admin/transactions/${transactionId}`,
    priority: 'normal',
    metadata: { brand_id: brandId, brand_name: brandName, amount, transaction_type: transactionType, transaction_id: transactionId },
    channels: ['web'],
  });
}

export default {
  sendBrandNotification,
  sendAdminNotification,
  broadcastToAdmins,
  notifyBrandDiamondPurchaseSuccess,
  notifyBrandDiamondPurchaseFailed,
  notifyBrandTokenEscrowSuccess,
  notifyBrandLowWalletBalance,
  notifyBrandWalletRefund,
  notifyAdminWalletAnomaly,
  notifyAdminHighValueTransaction,
};
