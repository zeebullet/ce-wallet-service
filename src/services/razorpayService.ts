import Razorpay from 'razorpay';
import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: config.razorpay?.keyId || process.env.RAZORPAY_KEY_ID || '',
  key_secret: config.razorpay?.keySecret || process.env.RAZORPAY_KEY_SECRET || '',
});

// ============ INTERFACES ============

export interface CreateOrderInput {
  amount: number;        // Amount in smallest currency unit (paise for INR)
  currency: string;      // 'INR'
  receipt: string;       // Unique receipt ID (transaction ID)
  notes?: {
    brand_id?: string;
    user_id?: string;
    package_id?: string;
    package_name?: string;
    tokens?: number;
    [key: string]: any;
  };
}

export interface RazorpayOrder {
  id: string;            // Razorpay order_id (order_xxxxxx)
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: 'created' | 'attempted' | 'paid';
  attempts: number;
  notes: any;
  created_at: number;
}

export interface VerifyPaymentInput {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface PaymentDetails {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: string;
  order_id: string;
  method: string;
  description: string;
  bank?: string;
  wallet?: string;
  vpa?: string;
  email: string;
  contact: string;
  fee: number;
  tax: number;
  captured: boolean;
  created_at: number;
}

// ============ RAZORPAY FUNCTIONS ============

/**
 * Create a Razorpay order for package purchase
 */
export async function createOrder(input: CreateOrderInput): Promise<RazorpayOrder> {
  try {
    const order = await razorpay.orders.create({
      amount: input.amount,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes || {},
    });

    logger.info('[Razorpay] Order created', {
      order_id: order.id,
      amount: input.amount,
      receipt: input.receipt,
    });

    return order as RazorpayOrder;
  } catch (error: any) {
    logger.error('[Razorpay] Failed to create order', {
      error: error.message,
      receipt: input.receipt,
    });
    throw new Error(`Failed to create payment order: ${error.message}`);
  }
}

/**
 * Verify Razorpay payment signature
 * This ensures the payment response is authentic and not tampered
 */
export function verifyPaymentSignature(input: VerifyPaymentInput): boolean {
  try {
    const keySecret = config.razorpay?.keySecret || process.env.RAZORPAY_KEY_SECRET || '';
    
    const body = input.razorpay_order_id + '|' + input.razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    const isValid = expectedSignature === input.razorpay_signature;

    if (!isValid) {
      logger.warn('[Razorpay] Invalid payment signature', {
        order_id: input.razorpay_order_id,
        payment_id: input.razorpay_payment_id,
      });
    }

    return isValid;
  } catch (error: any) {
    logger.error('[Razorpay] Signature verification failed', {
      error: error.message,
    });
    return false;
  }
}

/**
 * Fetch payment details from Razorpay
 */
export async function fetchPayment(paymentId: string): Promise<PaymentDetails> {
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return payment as PaymentDetails;
  } catch (error: any) {
    logger.error('[Razorpay] Failed to fetch payment', {
      error: error.message,
      payment_id: paymentId,
    });
    throw new Error(`Failed to fetch payment details: ${error.message}`);
  }
}

/**
 * Fetch order details from Razorpay
 */
export async function fetchOrder(orderId: string): Promise<RazorpayOrder> {
  try {
    const order = await razorpay.orders.fetch(orderId);
    return order as RazorpayOrder;
  } catch (error: any) {
    logger.error('[Razorpay] Failed to fetch order', {
      error: error.message,
      order_id: orderId,
    });
    throw new Error(`Failed to fetch order details: ${error.message}`);
  }
}

/**
 * Capture payment (if not auto-captured)
 */
export async function capturePayment(paymentId: string, amount: number): Promise<PaymentDetails> {
  try {
    const payment = await razorpay.payments.capture(paymentId, amount, 'INR');
    
    logger.info('[Razorpay] Payment captured', {
      payment_id: paymentId,
      amount,
    });
    
    return payment as PaymentDetails;
  } catch (error: any) {
    logger.error('[Razorpay] Failed to capture payment', {
      error: error.message,
      payment_id: paymentId,
    });
    throw new Error(`Failed to capture payment: ${error.message}`);
  }
}

/**
 * Initiate refund for a payment
 */
export async function createRefund(
  paymentId: string, 
  amount?: number, 
  notes?: Record<string, string>
): Promise<any> {
  try {
    const refundOptions: any = {
      speed: 'normal',
      notes: notes || {},
    };
    
    if (amount) {
      refundOptions.amount = amount;
    }

    const refund = await razorpay.payments.refund(paymentId, refundOptions);
    
    logger.info('[Razorpay] Refund initiated', {
      payment_id: paymentId,
      refund_id: refund.id,
      amount: amount || 'full',
    });
    
    return refund;
  } catch (error: any) {
    logger.error('[Razorpay] Failed to create refund', {
      error: error.message,
      payment_id: paymentId,
    });
    throw new Error(`Failed to create refund: ${error.message}`);
  }
}

/**
 * Get Razorpay key ID for frontend
 */
export function getKeyId(): string {
  return config.razorpay?.keyId || process.env.RAZORPAY_KEY_ID || '';
}
