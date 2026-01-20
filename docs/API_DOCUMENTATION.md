# CE Wallet Service - API Documentation

## Service Overview

| Property | Value |
|----------|-------|
| **Service Name** | ce-wallet-service |
| **Port** | 3013 |
| **Base Path** | `/api/wallet` |
| **Description** | Virtual currency, coins, gifts, purchases, withdrawals, referrals |

---

## Database Tables

### `ce_wallets`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| user_id | UUID | NO | FK: ce_users.id (unique) |
| coins_balance | DECIMAL(12,2) | NO | Current coin balance |
| total_earned | DECIMAL(12,2) | NO | Lifetime earnings |
| total_spent | DECIMAL(12,2) | NO | Lifetime spending |
| total_withdrawn | DECIMAL(12,2) | NO | Lifetime withdrawals |
| referral_code | VARCHAR(20) | NO | Unique referral code |
| referred_by | UUID | YES | FK: ce_users.id |
| created_at | TIMESTAMP | NO | Wallet creation |
| updated_at | TIMESTAMP | NO | Last update |

### `ce_coin_packages`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| name | VARCHAR(50) | NO | Package name |
| coins | INTEGER | NO | Coins in package |
| price | DECIMAL(10,2) | NO | Price in INR |
| bonus_coins | INTEGER | NO | Bonus coins |
| is_popular | BOOLEAN | NO | Featured package |
| is_active | BOOLEAN | NO | Available for purchase |
| sort_order | INTEGER | NO | Display order |

### `ce_transactions`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| user_id | UUID | NO | FK: ce_users.id |
| type | VARCHAR(30) | NO | Transaction type |
| amount | DECIMAL(10,2) | NO | Amount |
| balance_after | DECIMAL(12,2) | NO | Balance after transaction |
| description | TEXT | YES | Transaction description |
| reference_type | VARCHAR(30) | YES | gift, purchase, withdrawal |
| reference_id | UUID | YES | Related entity ID |
| status | VARCHAR(20) | NO | completed, pending, failed |
| created_at | TIMESTAMP | NO | Transaction timestamp |

**Transaction Types:**
- `credit` - Coins added
- `debit` - Coins spent
- `purchase` - Coins purchased
- `gift_received` - Gift from user
- `gift_sent` - Gift to user
- `withdrawal` - Withdrawal processed
- `refund` - Refund issued
- `bonus` - Bonus coins
- `referral` - Referral bonus

### `ce_gifts`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| name | VARCHAR(50) | NO | Gift name |
| icon_url | TEXT | NO | Gift icon |
| animation_url | TEXT | YES | Gift animation |
| coin_cost | INTEGER | NO | Cost in coins |
| category | VARCHAR(30) | NO | basic, premium, special |
| is_active | BOOLEAN | NO | Available |
| sort_order | INTEGER | NO | Display order |

### `ce_user_gifts`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| gift_id | UUID | NO | FK: ce_gifts.id |
| sender_id | UUID | NO | FK: ce_users.id |
| receiver_id | UUID | NO | FK: ce_users.id |
| video_id | UUID | YES | Video where gift sent |
| coin_amount | INTEGER | NO | Coins spent |
| message | TEXT | YES | Gift message |
| created_at | TIMESTAMP | NO | Gift timestamp |

### `ce_referrals`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| referrer_id | UUID | NO | FK: ce_users.id |
| referred_id | UUID | NO | FK: ce_users.id |
| bonus_paid | BOOLEAN | NO | Bonus awarded |
| bonus_amount | DECIMAL(10,2) | YES | Bonus coins |
| created_at | TIMESTAMP | NO | Referral timestamp |

### `ce_withdrawal_requests`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| user_id | UUID | NO | FK: ce_users.id |
| amount | DECIMAL(10,2) | NO | Withdrawal amount |
| status | VARCHAR(20) | NO | pending, processing, completed, rejected |
| payment_method | VARCHAR(30) | NO | bank_transfer, upi |
| account_details | JSONB | NO | Bank/UPI details |
| transaction_id | VARCHAR(100) | YES | External transaction ID |
| rejection_reason | TEXT | YES | If rejected |
| requested_at | TIMESTAMP | NO | Request timestamp |
| processed_at | TIMESTAMP | YES | Processing timestamp |

---

## API Endpoints

### Wallet

#### 1. Get Wallet

**GET** `/api/wallet`

Get user's wallet info.

**Response:**
```json
{
  "id": "wallet-uuid",
  "coins_balance": 5000,
  "total_earned": 15000,
  "total_spent": 8000,
  "total_withdrawn": 2000,
  "referral_code": "USER123ABC",
  "referred_by": null
}
```

**Auth Required:** Yes

---

#### 2. Get Balance

**GET** `/api/wallet/balance`

Get current coin balance.

**Response:**
```json
{
  "coins_balance": 5000,
  "inr_value": 500.00
}
```

**Auth Required:** Yes

---

### Transactions

#### 3. Get Transactions

**GET** `/api/wallet/transactions`

Get transaction history.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |
| type | string | all | Filter by type |

**Response:**
```json
{
  "transactions": [
    {
      "id": "trans-uuid",
      "type": "gift_received",
      "amount": 100,
      "balance_after": 5100,
      "description": "Gift from @john_doe",
      "reference_type": "gift",
      "reference_id": "gift-uuid",
      "status": "completed",
      "created_at": "2025-12-10T..."
    }
  ],
  "pagination": { ... }
}
```

**Auth Required:** Yes

---

#### 4. Get Transaction by ID

**GET** `/api/wallet/transactions/:transactionId`

Get single transaction details.

**Auth Required:** Yes

---

### Gifts

#### 5. Send Gift

**POST** `/api/wallet/gift`

Send gift to user/creator.

**Request Body:**
```json
{
  "gift_id": "gift-uuid",
  "receiver_id": "user-uuid",
  "video_id": "video-uuid",  // Optional
  "message": "Great video!"   // Optional
}
```

**Response:**
```json
{
  "success": true,
  "gift": {
    "id": "user-gift-uuid",
    "gift": {
      "name": "Heart",
      "icon_url": "https://..."
    },
    "coin_amount": 50,
    "balance_after": 4950
  }
}
```

**Auth Required:** Yes

---

#### 6. Get Gifts Received

**GET** `/api/wallet/gifts`

Get gifts received by user.

**Query Parameters:**
| Param | Type | Default |
|-------|------|---------|
| page | number | 1 |
| limit | number | 20 |

**Response:**
```json
{
  "gifts": [
    {
      "id": "user-gift-uuid",
      "gift": {
        "name": "Heart",
        "icon_url": "https://..."
      },
      "sender": {
        "id": "user-uuid",
        "username": "john_doe",
        "avatar_url": "https://..."
      },
      "video_id": "video-uuid",
      "coin_amount": 50,
      "message": "Great video!",
      "created_at": "2025-12-10T..."
    }
  ],
  "pagination": { ... },
  "total_received": 500
}
```

**Auth Required:** Yes

---

#### 7. Get Gifts Sent

**GET** `/api/wallet/gifts/sent`

Get gifts sent by user.

**Auth Required:** Yes

---

#### 8. Get Gift Types

**GET** `/api/wallet/gift-types`

Get available gift types.

**Response:**
```json
{
  "gifts": {
    "basic": [
      {
        "id": "gift-uuid",
        "name": "Heart",
        "icon_url": "https://...",
        "coin_cost": 10
      },
      {
        "id": "gift-uuid",
        "name": "Thumbs Up",
        "icon_url": "https://...",
        "coin_cost": 20
      }
    ],
    "premium": [
      {
        "id": "gift-uuid",
        "name": "Diamond",
        "icon_url": "https://...",
        "animation_url": "https://...",
        "coin_cost": 500
      }
    ],
    "special": [
      {
        "id": "gift-uuid",
        "name": "Crown",
        "icon_url": "https://...",
        "animation_url": "https://...",
        "coin_cost": 5000
      }
    ]
  }
}
```

**Auth Required:** No

---

### Purchases

#### 9. Purchase Coins

**POST** `/api/wallet/purchase`

Purchase a coin package.

**Request Body:**
```json
{
  "package_id": "package-uuid",
  "payment_method": "razorpay",
  "payment_id": "pay_xxxxx"
}
```

**Response:**
```json
{
  "success": true,
  "purchase": {
    "coins_added": 1100,
    "bonus_coins": 100,
    "total_coins": 1200,
    "balance_after": 6200,
    "transaction_id": "trans-uuid"
  }
}
```

**Auth Required:** Yes

---

#### 10. Get Coin Packages

**GET** `/api/wallet/packages`

Get available coin packages.

**Response:**
```json
{
  "packages": [
    {
      "id": "package-uuid",
      "name": "Starter",
      "coins": 100,
      "bonus_coins": 0,
      "price": 49,
      "is_popular": false
    },
    {
      "id": "package-uuid",
      "name": "Popular",
      "coins": 500,
      "bonus_coins": 50,
      "price": 199,
      "is_popular": true
    },
    {
      "id": "package-uuid",
      "name": "Premium",
      "coins": 2000,
      "bonus_coins": 300,
      "price": 699,
      "is_popular": false
    },
    {
      "id": "package-uuid",
      "name": "Ultimate",
      "coins": 10000,
      "bonus_coins": 2000,
      "price": 2799,
      "is_popular": false
    }
  ]
}
```

**Auth Required:** No

---

### Withdrawals

#### 11. Request Withdrawal

**POST** `/api/wallet/withdraw`

Request coin withdrawal.

**Request Body:**
```json
{
  "amount": 1000,
  "payment_method": "bank_transfer",
  "account_details": {
    "account_holder_name": "John Doe",
    "account_number": "1234567890",
    "ifsc_code": "SBIN0001234",
    "bank_name": "State Bank of India"
  }
}
```

**Or for UPI:**
```json
{
  "amount": 1000,
  "payment_method": "upi",
  "account_details": {
    "upi_id": "john@upi"
  }
}
```

**Validation:**
- Minimum: 100 coins
- Maximum: Available balance
- Must be creator with verified KYC

**Response:**
```json
{
  "success": true,
  "withdrawal": {
    "id": "withdrawal-uuid",
    "amount": 1000,
    "inr_amount": 100.00,
    "status": "pending",
    "estimated_date": "2025-12-15"
  }
}
```

**Auth Required:** Yes

---

#### 12. Get Withdrawals

**GET** `/api/wallet/withdrawals`

Get withdrawal history.

**Query Parameters:**
| Param | Type | Default |
|-------|------|---------|
| page | number | 1 |
| limit | number | 20 |
| status | string | all |

**Response:**
```json
{
  "withdrawals": [
    {
      "id": "withdrawal-uuid",
      "amount": 1000,
      "inr_amount": 100.00,
      "status": "completed",
      "payment_method": "bank_transfer",
      "transaction_id": "UTR123456",
      "requested_at": "2025-12-10T...",
      "processed_at": "2025-12-12T..."
    }
  ],
  "pagination": { ... }
}
```

**Auth Required:** Yes

---

#### 13. Get Withdrawal by ID

**GET** `/api/wallet/withdrawals/:withdrawalId`

Get withdrawal details.

**Auth Required:** Yes

---

### Referrals

#### 14. Get Referral Stats

**GET** `/api/wallet/referral`

Get referral statistics.

**Response:**
```json
{
  "referral_code": "USER123ABC",
  "referral_link": "https://ce.app/r/USER123ABC",
  "total_referrals": 15,
  "successful_referrals": 12,
  "total_earnings": 600,
  "pending_referrals": 3,
  "recent_referrals": [
    {
      "user": {
        "username": "newuser1",
        "avatar_url": "https://..."
      },
      "bonus_paid": true,
      "bonus_amount": 50,
      "created_at": "2025-12-08T..."
    }
  ]
}
```

**Auth Required:** Yes

---

#### 15. Apply Referral Code

**POST** `/api/wallet/referral/apply`

Apply referral code (for new users).

**Request Body:**
```json
{
  "referral_code": "USER123ABC"
}
```

**Response:**
```json
{
  "success": true,
  "bonus_coins": 50,
  "message": "Referral code applied! You received 50 bonus coins."
}
```

**Validation:**
- Can only apply once
- Cannot apply own code
- Valid code required

**Auth Required:** Yes

---

### Leaderboards

#### 16. Get Gifter Leaderboard

**GET** `/api/wallet/leaderboard/gifters`

Get top gifters.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| period | string | weekly | daily, weekly, monthly, all |
| limit | number | 10 | Max results |

**Response:**
```json
{
  "period": "weekly",
  "leaderboard": [
    {
      "rank": 1,
      "user": {
        "id": "user-uuid",
        "username": "top_gifter",
        "avatar_url": "https://...",
        "is_verified": true
      },
      "total_gifted": 50000,
      "gift_count": 250
    }
  ]
}
```

**Auth Required:** No

---

#### 17. Get Earner Leaderboard

**GET** `/api/wallet/leaderboard/earners`

Get top earners (creators).

**Query Parameters:**
| Param | Type | Default |
|-------|------|---------|
| period | string | weekly |
| limit | number | 10 |

**Response:**
```json
{
  "period": "weekly",
  "leaderboard": [
    {
      "rank": 1,
      "user": {
        "id": "user-uuid",
        "username": "top_creator",
        "avatar_url": "https://...",
        "is_verified": true
      },
      "total_earned": 100000,
      "gift_count": 500
    }
  ]
}
```

**Auth Required:** No

---

## Service Dependencies

| Dependency | Service | Purpose |
|------------|---------|---------|
| Users | ce-user-service | Get user info |
| Creator | ce-creator-service | Verify creator status |
| Notifications | ce-notification-service | Gift notifications |
| Payment Gateway | External (Razorpay) | Process purchases |

---

## Dependent Services

| Service | Dependency Type | Description |
|---------|-----------------|-------------|
| ce-creator-service | Reads balance | Withdrawal eligibility |

---

## Coin to INR Conversion

```
1 coin = ₹0.10 (for withdrawals)
₹1 = 10 coins (for purchases, varies by package)
```

---

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| 400 | Insufficient balance | Not enough coins |
| 400 | Cannot gift yourself | Self-gifting attempt |
| 400 | Invalid package | Package not found |
| 400 | Minimum withdrawal 100 | Below minimum |
| 400 | Referral already applied | Duplicate referral |
| 400 | Invalid referral code | Code not found |
| 403 | KYC required | Withdrawal needs KYC |
| 404 | Gift not found | Invalid gift ID |
| 404 | Wallet not found | User has no wallet |

---

## Brand Wallet APIs

Brand wallet APIs allow brands to manage their token and escrow balances for campaigns.

### Get Brand Wallet

**GET** `/api/wallet/brand`

Get brand wallet for the authenticated user. Creates a new wallet with free package if one doesn't exist.

**Headers:**
| Header | Type | Required |
|--------|------|----------|
| Authorization | Bearer token | Yes |
| x-user-id | UUID | Yes (from gateway) |

**Response:**
```json
{
  "success": true,
  "data": {
    "wallet": {
      "id": "wallet-uuid",
      "brand_id": "brand-uuid",
      "user_id": "user-uuid",
      "token_balance": 10,
      "total_tokens_credited": 10,
      "total_tokens_debited": 0,
      "escrow_balance": 0,
      "escrow_on_hold": 0,
      "total_escrow_deposited": 0,
      "total_escrow_released": 0,
      "total_escrow_refunded": 0,
      "current_package": "free",
      "package_activated_at": "2026-01-15T10:00:00Z",
      "package_expires_at": null,
      "last_transaction_at": "2026-01-15T10:00:00Z",
      "created_at": "2026-01-15T10:00:00Z",
      "updated_at": "2026-01-15T10:00:00Z"
    },
    "package": {
      "id": "package-uuid",
      "user_type": "brand",
      "name": "free",
      "display_name": "Free Trial",
      "description": "Get started with 10 free tokens",
      "tokens_included": 10,
      "price": 0,
      "currency": "INR",
      "campaign_token_cost": 1,
      "report_token_cost": 1,
      "validity_days": null,
      "features": ["10 tokens included", "Basic support"],
      "is_active": true,
      "sort_order": 0
    },
    "stats": {
      "token_balance": 10,
      "escrow_balance": 0,
      "escrow_on_hold": 0,
      "available_escrow": 0,
      "total_tokens_used": 0,
      "package_days_remaining": null,
      "is_package_expired": false
    }
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | UNAUTHORIZED | User not authenticated |
| 404 | BRAND_NOT_FOUND | User is not linked to any brand |

**Auth Required:** Yes

---

### Get Brand Transactions

**GET** `/api/wallet/brand/transactions`

Get brand wallet transactions with pagination and filters.

**Headers:**
| Header | Type | Required |
|--------|------|----------|
| Authorization | Bearer token | Yes |

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page (max 100) |
| type | string | - | Filter by transaction type |
| currency_type | string | - | Filter by `token` or `escrow` |
| status | string | - | Filter by status |

**Transaction Types:**
- `token_credit` - Tokens added (package purchase, bonus)
- `token_debit` - Tokens deducted (campaign creation, report download)
- `escrow_deposit` - Escrow funds deposited
- `escrow_hold` - Escrow held for campaign
- `escrow_release` - Escrow released to creators
- `escrow_refund` - Escrow refunded to brand

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "txn-uuid",
        "brand_id": "brand-uuid",
        "user_id": "user-uuid",
        "transaction_type": "token_credit",
        "amount": 10,
        "currency": "INR",
        "currency_type": "token",
        "balance_after": 10,
        "reference_type": "package",
        "reference_id": "package-uuid",
        "payment_method": null,
        "payment_gateway_id": null,
        "status": "completed",
        "description": "Welcome tokens from Free Trial",
        "metadata": {
          "package_name": "free",
          "package_display_name": "Free Trial",
          "tokens_included": 10
        },
        "failure_reason": null,
        "processed_at": "2026-01-15T10:00:00Z",
        "created_at": "2026-01-15T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

**Auth Required:** Yes

---

### Get Brand Packages

**GET** `/api/wallet/brand/packages`

Get all available packages for brands.

**Response:**
```json
{
  "success": true,
  "data": {
    "packages": [
      {
        "id": "package-uuid",
        "user_type": "brand",
        "name": "free",
        "display_name": "Free Trial",
        "description": "Get started with 10 free tokens",
        "tokens_included": 10,
        "price": 0,
        "currency": "INR",
        "campaign_token_cost": 1,
        "report_token_cost": 1,
        "validity_days": null,
        "features": ["10 tokens included", "Basic support"],
        "is_active": true,
        "sort_order": 0
      },
      {
        "id": "package-uuid-2",
        "user_type": "brand",
        "name": "starter",
        "display_name": "Starter",
        "description": "Perfect for small campaigns",
        "tokens_included": 50,
        "price": 4999,
        "currency": "INR",
        "campaign_token_cost": 1,
        "report_token_cost": 1,
        "validity_days": 90,
        "features": ["50 tokens included", "Email support", "Basic analytics"],
        "is_active": true,
        "sort_order": 1
      }
    ]
  }
}
```

**Auth Required:** No

---

### Check Token Balance

**GET** `/api/wallet/brand/check-tokens`

Check if user has sufficient tokens for an action.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| required | number | 1 | Number of tokens required |

**Response:**
```json
{
  "success": true,
  "data": {
    "has_enough_tokens": true,
    "required_tokens": 1,
    "token_costs": {
      "campaign_token_cost": 1,
      "report_token_cost": 1
    }
  }
}
```

**Auth Required:** Yes

---

## Brand Wallet Flow

### First Time Login / Wallet Creation

1. Brand registers and admin approves
2. User logs in with brand's contact email/phone
3. Auth service links `user_id` to brand
4. When brand accesses `/api/wallet/brand`:
   - System checks if user is linked to a brand
   - If no wallet exists, creates one with free package
   - Free package provides initial tokens (e.g., 10 tokens)
   - Transaction record is created for initial tokens

### Token Usage

| Action | Token Cost | Description |
|--------|------------|-------------|
| Create Campaign | `campaign_token_cost` | Uses tokens from current package rate |
| Download Report | `report_token_cost` | Uses tokens from current package rate |

### Escrow Management

- **Deposit**: Brand deposits funds for campaign payments
- **Hold**: Funds held when campaign is active
- **Release**: Funds released to creators on campaign completion
- **Refund**: Unused escrow returned to brand

---

## Brand Wallet Recharge APIs

These APIs handle wallet recharge using Razorpay payment gateway.

### Initiate Recharge

**POST** `/api/wallet/brand/recharge/initiate`

Create a Razorpay order to purchase a package.

**Headers:**
| Header | Type | Required |
|--------|------|----------|
| Authorization | Bearer token | Yes |

**Request Body:**
```json
{
  "package_id": "uuid-of-package-to-purchase"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "order_id": "order_NxxxxxxxxxxxxX",
    "razorpay_key_id": "rzp_test_xxxxxxxxxxxx",
    "amount": 499900,
    "currency": "INR",
    "transaction_id": "uuid-of-pending-transaction",
    "package": {
      "id": "package-uuid",
      "name": "starter",
      "display_name": "Starter",
      "tokens_included": 50,
      "price": 4999
    },
    "prefill": {
      "name": "Brand Name",
      "email": "brand@example.com",
      "contact": "9876543210"
    }
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 404 | PACKAGE_NOT_FOUND | Package doesn't exist or is inactive |
| 400 | FREE_PACKAGE | Cannot purchase free packages |

**Auth Required:** Yes

**Frontend Usage:**
```javascript
// After getting the response, open Razorpay checkout
const options = {
  key: response.data.razorpay_key_id,
  amount: response.data.amount,
  currency: response.data.currency,
  order_id: response.data.order_id,
  name: 'Your App Name',
  description: `Purchase ${response.data.package.display_name}`,
  prefill: response.data.prefill,
  handler: function(paymentResponse) {
    // Call verify API with paymentResponse
  }
};
const rzp = new Razorpay(options);
rzp.open();
```

---

### Verify Recharge

**POST** `/api/wallet/brand/recharge/verify`

Verify payment after Razorpay checkout completes.

**Request Body:**
```json
{
  "razorpay_order_id": "order_NxxxxxxxxxxxxX",
  "razorpay_payment_id": "pay_NxxxxxxxxxxxxX",
  "razorpay_signature": "signature-from-razorpay",
  "transaction_id": "uuid-from-initiate-response"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "transaction_id": "uuid",
    "tokens_credited": 50,
    "new_balance": 60,
    "package_name": "Starter",
    "message": "Successfully credited 50 tokens to your wallet"
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | PAYMENT_VERIFICATION_FAILED | Invalid signature |
| 409 | ALREADY_PROCESSED | Transaction already processed |

**Auth Required:** Yes

---

### Recharge Webhook

**POST** `/api/wallet/brand/recharge/webhook`

Razorpay webhook endpoint for backup payment processing.

**Headers:**
| Header | Type | Description |
|--------|------|-------------|
| x-razorpay-signature | string | Webhook signature |

**Events Handled:**
- `payment.captured` - Process payment if not already done via verify API

**Note:** Configure this webhook URL in Razorpay Dashboard.

---

### Get Recharge History

**GET** `/api/wallet/brand/recharge/history`

Get brand's recharge/purchase history.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "txn-uuid",
        "transaction_type": "token_purchase",
        "amount": 4999,
        "currency": "INR",
        "status": "completed",
        "description": "Package purchase: Starter (50 tokens)",
        "payment_method": "razorpay",
        "payment_gateway_id": "order_NxxxxxxxxxxxxX",
        "processed_at": "2026-01-20T10:00:00Z",
        "created_at": "2026-01-20T09:55:00Z",
        "metadata": {
          "package_id": "uuid",
          "package_name": "starter",
          "tokens_included": 50,
          "razorpay_payment_id": "pay_NxxxxxxxxxxxxX"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

**Auth Required:** Yes

---

## Recharge Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    WALLET RECHARGE FLOW                         │
└─────────────────────────────────────────────────────────────────┘

  FRONTEND                    BACKEND                   RAZORPAY
     │                           │                          │
     │ 1. POST /brand/recharge/initiate                     │
     │   { package_id }          │                          │
     │──────────────────────────>│                          │
     │                           │                          │
     │                           │ 2. Create Order          │
     │                           │─────────────────────────>│
     │                           │<─────────────────────────│
     │                           │   { order_id }           │
     │                           │                          │
     │                           │ 3. Save pending txn      │
     │                           │                          │
     │<──────────────────────────│                          │
     │   { order_id, key_id,     │                          │
     │     transaction_id }      │                          │
     │                           │                          │
     │ 4. Open Razorpay Checkout │                          │
     │─────────────────────────────────────────────────────>│
     │                           │                          │
     │<─────────────────────────────────────────────────────│
     │   { payment_id, signature }                          │
     │                           │                          │
     │ 5. POST /brand/recharge/verify                       │
     │   { order_id, payment_id, │                          │
     │     signature, txn_id }   │                          │
     │──────────────────────────>│                          │
     │                           │                          │
     │                           │ 6. Verify signature      │
     │                           │ 7. Credit tokens         │
     │                           │ 8. Update transaction    │
     │                           │                          │
     │<──────────────────────────│                          │
     │   { tokens_credited,      │                          │
     │     new_balance }         │                          │
     │                           │                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Environment Variables

Add these to your `.env` file:

```bash
# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```
