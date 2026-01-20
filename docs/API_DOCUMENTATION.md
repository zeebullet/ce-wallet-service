# CE Wallet Service - API Documentation

## Service Overview

| Property | Value |
|----------|-------|
| **Service Name** | ce-wallet-service |
| **Port** | 3008 |
| **Base Path** | `/api/v1/wallet` |
| **Description** | Creator wallet, brand wallet, tokens, escrow management |

---

## API Endpoints

### 1. Get Balance

**GET** `/api/v1/wallet/balance`

Get creator wallet balance.

**Headers:**
| Header | Type | Required |
|--------|------|----------|
| Authorization | Bearer token | Yes |

**Response:**
```json
{
  "success": true,
  "data": {
    "balance": 15000.00,
    "pending_balance": 2000.00,
    "available_balance": 13000.00,
    "currency": "INR"
  }
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| balance | number | Total wallet balance |
| pending_balance | number | Balance pending/locked for withdrawals |
| available_balance | number | Balance available for use (balance - pending) |
| currency | string | Currency code |

**Auth Required:** Yes

---

### 2. Get Wallet Summary

**GET** `/api/v1/wallet/summary`

Get creator wallet summary with detailed stats.

**Headers:**
| Header | Type | Required |
|--------|------|----------|
| Authorization | Bearer token | Yes |

**Response:**
```json
{
  "success": true,
  "data": {
    "wallet": {
      "user_id": "user-uuid",
      "balance": 15000.00,
      "pending_balance": 2000.00,
      "total_earnings": 50000.00,
      "total_withdrawals": 35000.00,
      "currency": "INR",
      "last_transaction_at": "2026-01-20T10:30:00Z",
      "created_at": "2025-06-15T08:00:00Z",
      "updated_at": "2026-01-20T10:30:00Z"
    },
    "stats": {
      "total_earnings": 50000.00,
      "total_withdrawals": 35000.00,
      "pending_withdrawals": 2000.00,
      "available_for_withdrawal": 13000.00
    }
  }
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| wallet | object | Full wallet object |
| stats.total_earnings | number | Lifetime earnings from campaigns |
| stats.total_withdrawals | number | Lifetime withdrawn amount |
| stats.pending_withdrawals | number | Currently processing withdrawals |
| stats.available_for_withdrawal | number | Amount available to withdraw now |

**Auth Required:** Yes

---

### 3. Get Earnings Leaderboard

**GET** `/api/v1/wallet/leaderboard`

Get top earning creators leaderboard.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| period | string | `all_time` | Time period: `all_time`, `monthly`, `weekly` |
| limit | number | 10 | Number of results (max 100) |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "user_id": "user-uuid-1",
      "username": "top_creator",
      "display_name": "Top Creator",
      "avatar_url": "https://cdn.example.com/avatars/user1.jpg",
      "total_earned": 150000.00
    },
    {
      "user_id": "user-uuid-2",
      "username": "awesome_creator",
      "display_name": "Awesome Creator",
      "avatar_url": "https://cdn.example.com/avatars/user2.jpg",
      "total_earned": 125000.00
    }
  ]
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| user_id | string | Creator's user ID |
| username | string | Creator's username |
| display_name | string | Creator's display name |
| avatar_url | string | Creator's avatar URL (nullable) |
| total_earned | number | Total earnings in the period |

**Auth Required:** No

**Notes:**
- Only creators (`is_creator = true`) are included
- For `monthly`: earnings from start of current month
- For `weekly`: earnings from start of current week (Sunday)
- For `all_time`: lifetime total earnings

---

### 4. Get Brand Wallet

**GET** `/api/v1/wallet/brand`

Get brand wallet with token balance and escrow details. Creates a new wallet with free package if one doesn't exist.

**Headers:**
| Header | Type | Required |
|--------|------|----------|
| Authorization | Bearer token | Yes |

**Response:**
```json
{
  "success": true,
  "data": {
    "wallet": {
      "id": "wallet-uuid",
      "brand_id": "brand-uuid",
      "user_id": "user-uuid",
      "token_balance": 45,
      "total_tokens_credited": 60,
      "total_tokens_debited": 15,
      "escrow_balance": 50000.00,
      "escrow_on_hold": 15000.00,
      "total_escrow_deposited": 100000.00,
      "total_escrow_released": 45000.00,
      "total_escrow_refunded": 5000.00,
      "current_package": "starter",
      "package_activated_at": "2026-01-15T10:00:00Z",
      "package_expires_at": "2026-04-15T10:00:00Z",
      "last_transaction_at": "2026-01-20T09:30:00Z",
      "created_at": "2026-01-15T10:00:00Z",
      "updated_at": "2026-01-20T09:30:00Z"
    },
    "package": {
      "id": "package-uuid",
      "user_type": "brand",
      "name": "starter",
      "display_name": "Starter",
      "description": "Perfect for small campaigns",
      "tokens_included": 50,
      "price": 4999.00,
      "currency": "INR",
      "campaign_token_cost": 1,
      "report_token_cost": 1,
      "validity_days": 90,
      "features": ["50 tokens included", "Email support", "Basic analytics"],
      "is_active": true,
      "sort_order": 1
    },
    "stats": {
      "token_balance": 45,
      "escrow_balance": 50000.00,
      "escrow_on_hold": 15000.00,
      "available_escrow": 35000.00,
      "total_tokens_used": 15,
      "package_days_remaining": 85,
      "is_package_expired": false
    }
  }
}
```

**Response Fields:**

**wallet object:**
| Field | Type | Description |
|-------|------|-------------|
| id | string | Wallet ID |
| brand_id | string | Associated brand ID |
| user_id | string | User who owns the wallet |
| token_balance | number | Current token balance |
| total_tokens_credited | number | Lifetime tokens added |
| total_tokens_debited | number | Lifetime tokens used |
| escrow_balance | number | Available escrow balance (INR) |
| escrow_on_hold | number | Escrow held for active campaigns |
| total_escrow_deposited | number | Lifetime escrow deposits |
| total_escrow_released | number | Lifetime payments to creators |
| total_escrow_refunded | number | Lifetime escrow refunds |
| current_package | string | Current package name |
| package_activated_at | string | When package was activated |
| package_expires_at | string | When package expires (nullable) |

**package object:**
| Field | Type | Description |
|-------|------|-------------|
| id | string | Package ID |
| name | string | Package internal name |
| display_name | string | Package display name |
| tokens_included | number | Tokens included in package |
| price | number | Package price in INR |
| campaign_token_cost | number | Tokens per campaign creation |
| report_token_cost | number | Tokens per report download |
| validity_days | number | Package validity in days (nullable = unlimited) |
| features | array | List of package features |

**stats object:**
| Field | Type | Description |
|-------|------|-------------|
| token_balance | number | Current token balance |
| escrow_balance | number | Total escrow balance |
| escrow_on_hold | number | Escrow currently held |
| available_escrow | number | Escrow available for new campaigns |
| total_tokens_used | number | Tokens used so far |
| package_days_remaining | number | Days until package expires (nullable) |
| is_package_expired | boolean | Whether package has expired |

**Error Responses:**

| Status | Error Code | Description |
|--------|------------|-------------|
| 401 | UNAUTHORIZED | User not authenticated |
| 404 | BRAND_NOT_FOUND | User is not linked to any brand |

**Example Error Response:**
```json
{
  "success": false,
  "error": "BRAND_NOT_FOUND",
  "message": "No brand linked to this user. Please complete brand registration first."
}
```

**Auth Required:** Yes

**Notes:**
- If the brand doesn't have a wallet, one is automatically created with the free package
- Free package provides initial tokens (e.g., 10 tokens) for trial
- `available_escrow = escrow_balance - escrow_on_hold`

---

### 5. Get Brand Transactions

**GET** `/api/v1/wallet/brand/transactions`

Get brand wallet transaction history with filters.

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
        "amount": 50,
        "currency": "INR",
        "currency_type": "token",
        "balance_after": 50,
        "reference_type": "package",
        "reference_id": "package-uuid",
        "payment_method": "razorpay",
        "payment_gateway_id": "order_xyz123",
        "status": "completed",
        "description": "Package purchase: Starter (50 tokens)",
        "metadata": {
          "package_name": "starter",
          "tokens_included": 50
        },
        "processed_at": "2026-01-20T10:00:00Z",
        "created_at": "2026-01-20T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 15,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

**Transaction Types:**
- `token_credit` - Tokens added (package purchase)
- `token_debit` - Tokens used (campaign, report)
- `escrow_deposit` - Escrow funds added
- `escrow_hold` - Escrow held for campaign
- `escrow_release` - Escrow released to creator
- `escrow_refund` - Escrow refunded

**Auth Required:** Yes

---

### 6. Get Brand Packages

**GET** `/api/v1/wallet/brand/packages`

Get all available packages for brands.

**Response:**
```json
{
  "success": true,
  "data": {
    "packages": [
      {
        "id": "package-uuid-1",
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

### 7. Check Token Balance

**GET** `/api/v1/wallet/brand/check-tokens`

Check if brand has enough tokens for various actions.

**Headers:**
| Header | Type | Required |
|--------|------|----------|
| Authorization | Bearer token | Yes |

**Response:**
```json
{
  "success": true,
  "data": {
    "has_enough_tokens_for_search": true,
    "required_tokens_for_search": 1,
    "has_enough_tokens_for_campaign": true,
    "required_tokens_for_campaign": 1,
    "token_costs": {
      "campaign_token_cost": 1,
      "report_token_cost": 1
    }
  }
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| has_enough_tokens_for_search | boolean | Can perform creator search |
| required_tokens_for_search | number | Tokens needed for search |
| has_enough_tokens_for_campaign | boolean | Can create a campaign |
| required_tokens_for_campaign | number | Tokens needed for campaign |
| token_costs | object | Token costs from current package |

**Auth Required:** Yes

---

## Brand Recharge APIs

### 8. Initiate Recharge

**POST** `/api/v1/wallet/brand/recharge/initiate`

Create a Razorpay order to purchase a token package.

**Headers:**
| Header | Type | Required |
|--------|------|----------|
| Authorization | Bearer token | Yes |

**Request Body:**
```json
{
  "package_id": "uuid-of-package"
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
    "transaction_id": "txn-uuid",
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
| 404 | PACKAGE_NOT_FOUND | Package doesn't exist |
| 400 | FREE_PACKAGE | Cannot purchase free packages |

**Auth Required:** Yes

---

### 9. Verify Recharge

**POST** `/api/v1/wallet/brand/recharge/verify`

Verify Razorpay payment and credit tokens.

**Headers:**
| Header | Type | Required |
|--------|------|----------|
| Authorization | Bearer token | Yes |

**Request Body:**
```json
{
  "razorpay_order_id": "order_NxxxxxxxxxxxxX",
  "razorpay_payment_id": "pay_NxxxxxxxxxxxxX",
  "razorpay_signature": "signature-from-razorpay",
  "transaction_id": "txn-uuid-from-initiate"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "transaction_id": "txn-uuid",
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

### 10. Recharge Webhook

**POST** `/api/v1/wallet/brand/recharge/webhook`

Razorpay webhook endpoint for payment events.

**Headers:**
| Header | Type | Description |
|--------|------|-------------|
| x-razorpay-signature | string | Webhook signature |

**Events Handled:**
- `payment.captured` - Process payment if not done via verify API

**Auth Required:** No (webhook signature validated)

---

### 11. Get Recharge History

**GET** `/api/v1/wallet/brand/recharge/history`

Get brand's recharge/purchase history.

**Headers:**
| Header | Type | Required |
|--------|------|----------|
| Authorization | Bearer token | Yes |

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
        "transaction_type": "token_credit",
        "amount": 4999,
        "currency": "INR",
        "status": "completed",
        "description": "Package purchase: Starter (50 tokens)",
        "payment_method": "razorpay",
        "payment_gateway_id": "order_xyz123",
        "processed_at": "2026-01-20T10:00:00Z",
        "metadata": {
          "package_name": "starter",
          "tokens_included": 50
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 3,
      "totalPages": 1
    }
  }
}
```

**Auth Required:** Yes

---

## Brand Escrow APIs

### 12. Get Escrow Balance

**GET** `/api/v1/wallet/brand/escrow/balance`

Get detailed escrow balance breakdown.

**Headers:**
| Header | Type | Required |
|--------|------|----------|
| Authorization | Bearer token | Yes |

**Response:**
```json
{
  "success": true,
  "data": {
    "escrow_balance": 50000.00,
    "escrow_on_hold": 15000.00,
    "available_escrow": 35000.00,
    "total_escrow_deposited": 100000.00,
    "total_escrow_released": 45000.00,
    "total_escrow_refunded": 5000.00
  }
}
```

**Auth Required:** Yes

---

### 13. Initiate Escrow Deposit

**POST** `/api/v1/wallet/brand/escrow/deposit/initiate`

Initiate escrow deposit via Razorpay.

**Headers:**
| Header | Type | Required |
|--------|------|----------|
| Authorization | Bearer token | Yes |

**Request Body:**
```json
{
  "amount": 50000,
  "campaign_id": "campaign-uuid"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "order_id": "order_NxxxxxxxxxxxxX",
    "razorpay_key_id": "rzp_test_xxxxxxxxxxxx",
    "amount": 5000000,
    "currency": "INR",
    "transaction_id": "txn-uuid",
    "prefill": {
      "name": "Brand Name",
      "email": "brand@example.com"
    }
  }
}
```

**Auth Required:** Yes

---

### 14. Verify Escrow Deposit

**POST** `/api/v1/wallet/brand/escrow/deposit/verify`

Verify Razorpay payment and credit escrow.

**Headers:**
| Header | Type | Required |
|--------|------|----------|
| Authorization | Bearer token | Yes |

**Request Body:**
```json
{
  "razorpay_order_id": "order_NxxxxxxxxxxxxX",
  "razorpay_payment_id": "pay_NxxxxxxxxxxxxX",
  "razorpay_signature": "signature-from-razorpay",
  "transaction_id": "txn-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "transaction_id": "txn-uuid",
    "amount_credited": 50000,
    "new_escrow_balance": 85000,
    "message": "Successfully deposited ₹50000 to escrow"
  }
}
```

**Auth Required:** Yes

---

### 15. Hold Escrow

**POST** `/api/v1/wallet/brand/escrow/hold`

Hold escrow for a campaign (when campaign is activated).

**Headers:**
| Header | Type | Required |
|--------|------|----------|
| Authorization | Bearer token | Yes |

**Request Body:**
```json
{
  "amount": 10000,
  "campaign_id": "campaign-uuid",
  "campaign_title": "Summer Sale Campaign"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transaction_id": "txn-uuid",
    "amount_held": 10000,
    "escrow_balance": 40000,
    "escrow_on_hold": 25000,
    "available_escrow": 15000
  }
}
```

**Error Responses:**
| Status | Error | Description |
|--------|-------|-------------|
| 400 | INSUFFICIENT_ESCROW | Not enough available escrow |

**Auth Required:** Yes

---

### 16. Release Escrow

**POST** `/api/v1/wallet/brand/escrow/release`

Release held escrow to a creator (when deliverable is approved).

**Headers:**
| Header | Type | Required |
|--------|------|----------|
| Authorization | Bearer token | Yes |

**Request Body:**
```json
{
  "amount": 5000,
  "campaign_id": "campaign-uuid",
  "application_id": "application-uuid",
  "creator_id": "creator-uuid",
  "creator_name": "CreatorName"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transaction_id": "txn-uuid",
    "amount_released": 5000,
    "escrow_on_hold": 20000,
    "total_escrow_released": 50000,
    "creator_payment": {
      "creator_id": "creator-uuid",
      "amount": 5000
    }
  }
}
```

**Auth Required:** Yes

---

### 17. Refund Escrow

**POST** `/api/v1/wallet/brand/escrow/refund`

Refund held escrow back to available balance (when campaign is cancelled).

**Headers:**
| Header | Type | Required |
|--------|------|----------|
| Authorization | Bearer token | Yes |

**Request Body:**
```json
{
  "amount": 5000,
  "campaign_id": "campaign-uuid",
  "reason": "Campaign cancelled by brand"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transaction_id": "txn-uuid",
    "amount_refunded": 5000,
    "escrow_balance": 45000,
    "escrow_on_hold": 15000,
    "available_escrow": 30000
  }
}
```

**Auth Required:** Yes

---

### 18. Get Escrow Transactions

**GET** `/api/v1/wallet/brand/escrow/transactions`

Get escrow-specific transaction history.

**Headers:**
| Header | Type | Required |
|--------|------|----------|
| Authorization | Bearer token | Yes |

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
        "id": "txn-uuid-1",
        "transaction_type": "escrow_deposit",
        "amount": 50000,
        "currency": "INR",
        "status": "completed",
        "description": "Escrow deposit",
        "processed_at": "2026-01-20T10:00:00Z"
      },
      {
        "id": "txn-uuid-2",
        "transaction_type": "escrow_hold",
        "amount": 15000,
        "currency": "INR",
        "status": "completed",
        "description": "Escrow held for campaign: Summer Sale",
        "reference_type": "campaign",
        "reference_id": "campaign-uuid",
        "processed_at": "2026-01-20T11:00:00Z"
      },
      {
        "id": "txn-uuid-3",
        "transaction_type": "escrow_release",
        "amount": 5000,
        "currency": "INR",
        "status": "completed",
        "description": "Escrow released to CreatorName",
        "reference_type": "application",
        "reference_id": "application-uuid",
        "processed_at": "2026-01-20T12:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 3,
      "totalPages": 1
    }
  }
}
```

**Auth Required:** Yes

---

## Token vs Escrow

| Feature | Tokens | Escrow |
|---------|--------|--------|
| **Purpose** | Pay for platform features | Pay creators for campaigns |
| **Unit** | Integer tokens | INR currency |
| **Usage** | Campaign creation, report downloads | Creator payments |
| **Recharge** | Purchase token packages | Deposit escrow funds |
| **Refundable** | No | Yes (unused held amount) |

### Escrow Flow
```
  escrow_balance          escrow_on_hold           Creator Wallet
       │                        │                        │
       │   Campaign Created     │                        │
       │───────────────────────>│                        │
       │        (HOLD)          │                        │
       │                        │   Deliverable Approved │
       │                        │───────────────────────>│
       │                        │       (RELEASE)        │
       │   Campaign Cancelled   │                        │
       │<───────────────────────│                        │
       │        (REFUND)        │                        │
```

---

## API Summary

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/balance` | Get creator wallet balance | Yes |
| GET | `/summary` | Get creator wallet summary with stats | Yes |
| GET | `/leaderboard` | Get top earning creators | No |
| GET | `/brand` | Get brand wallet (tokens & escrow) | Yes |
| GET | `/brand/transactions` | Get brand transaction history | Yes |
| GET | `/brand/packages` | Get available brand packages | No |
| GET | `/brand/check-tokens` | Check token balance for actions | Yes |
| POST | `/brand/recharge/initiate` | Initiate package purchase | Yes |
| POST | `/brand/recharge/verify` | Verify payment | Yes |
| POST | `/brand/recharge/webhook` | Razorpay webhook | No |
| GET | `/brand/recharge/history` | Get recharge history | Yes |
| GET | `/brand/escrow/balance` | Get escrow balance | Yes |
| POST | `/brand/escrow/deposit/initiate` | Initiate escrow deposit | Yes |
| POST | `/brand/escrow/deposit/verify` | Verify escrow deposit | Yes |
| POST | `/brand/escrow/hold` | Hold escrow for campaign | Yes |
| POST | `/brand/escrow/release` | Release escrow to creator | Yes |
| POST | `/brand/escrow/refund` | Refund held escrow | Yes |
| GET | `/brand/escrow/transactions` | Get escrow transactions | Yes |
| POST | `/bank-accounts` | Add bank account | Yes |
| GET | `/bank-accounts` | Get user's bank accounts | Yes |
| PUT | `/bank-accounts/:id/primary` | Set primary bank account | Yes |
| DELETE | `/bank-accounts/:id` | Delete bank account | Yes |
| GET | `/transactions` | Get user transactions | Yes |
| GET | `/transactions/summary` | Get transaction summary | Yes |
| GET | `/transactions/:id` | Get transaction by ID | No |
| POST | `/withdrawals` | Request withdrawal | Yes |
| GET | `/admin/bank-accounts/pending` | Get pending verifications | Admin |
| POST | `/admin/bank-accounts/:id/verify` | Verify bank account | Admin |
| GET | `/admin/withdrawals/pending` | Get pending withdrawals | Admin |
| POST | `/admin/withdrawals/:id/process` | Process withdrawal | Admin |

---

## Bank Account APIs

### 19. Add Bank Account

**POST** `/api/v1/wallet/bank-accounts`

Add a new bank account for withdrawals.

**Headers:**
| Header | Type | Required |
|--------|------|----------|
| Authorization | Bearer token | Yes |

**Request Body:**
```json
{
  "account_holder_name": "John Doe",
  "account_number": "1234567890123456",
  "ifsc_code": "HDFC0001234",
  "bank_name": "HDFC Bank"
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| account_holder_name | string | Yes | Name as per bank records |
| account_number | string | Yes | Bank account number |
| ifsc_code | string | Yes | Bank IFSC code |
| bank_name | string | Yes | Name of the bank |

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "account-uuid",
    "user_id": "user-uuid",
    "account_holder_name": "John Doe",
    "account_number_masked": "XXXXXXXXXXXX3456",
    "ifsc_code": "HDFC0001234",
    "bank_name": "HDFC Bank",
    "is_primary": true,
    "is_verified": false,
    "verification_status": "pending",
    "created_at": "2026-01-20T10:00:00Z"
  }
}
```

**Auth Required:** Yes

**Notes:**
- First bank account added becomes the primary account automatically
- Bank accounts require admin verification before withdrawals

---

### 20. Get Bank Accounts

**GET** `/api/v1/wallet/bank-accounts`

Get all bank accounts for the authenticated user.

**Headers:**
| Header | Type | Required |
|--------|------|----------|
| Authorization | Bearer token | Yes |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "account-uuid-1",
      "user_id": "user-uuid",
      "account_holder_name": "John Doe",
      "account_number_masked": "XXXXXXXXXXXX3456",
      "ifsc_code": "HDFC0001234",
      "bank_name": "HDFC Bank",
      "is_primary": true,
      "is_verified": true,
      "verification_status": "verified",
      "created_at": "2026-01-15T10:00:00Z"
    },
    {
      "id": "account-uuid-2",
      "user_id": "user-uuid",
      "account_holder_name": "John Doe",
      "account_number_masked": "XXXXXXXXXXXX7890",
      "ifsc_code": "ICIC0001234",
      "bank_name": "ICICI Bank",
      "is_primary": false,
      "is_verified": false,
      "verification_status": "pending",
      "created_at": "2026-01-20T10:00:00Z"
    }
  ]
}
```

**Auth Required:** Yes

---

### 21. Set Primary Bank Account

**PUT** `/api/v1/wallet/bank-accounts/:id/primary`

Set a bank account as the primary account for withdrawals.

**Headers:**
| Header | Type | Required |
|--------|------|----------|
| Authorization | Bearer token | Yes |

**Path Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| id | string | Bank account UUID |

**Response:**
```json
{
  "success": true,
  "message": "Primary account updated"
}
```

**Auth Required:** Yes

---

### 22. Delete Bank Account

**DELETE** `/api/v1/wallet/bank-accounts/:id`

Delete a bank account.

**Headers:**
| Header | Type | Required |
|--------|------|----------|
| Authorization | Bearer token | Yes |

**Path Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| id | string | Bank account UUID |

**Response:**
```json
{
  "success": true,
  "message": "Bank account deleted"
}
```

**Auth Required:** Yes

**Notes:**
- Cannot delete the only primary account if there are pending withdrawals

---

## Transaction APIs

### 23. Get Transactions

**GET** `/api/v1/wallet/transactions`

Get user's transaction history.

**Headers:**
| Header | Type | Required |
|--------|------|----------|
| Authorization | Bearer token | Yes |

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page (max 100) |
| transaction_type | string | - | Filter by transaction type |
| status | string | - | Filter by status |

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "txn-uuid-1",
        "user_id": "user-uuid",
        "transaction_type": "earning",
        "amount": 5000.00,
        "currency": "INR",
        "status": "completed",
        "description": "Campaign payment: Summer Fashion Campaign",
        "reference_type": "campaign",
        "reference_id": "campaign-uuid",
        "balance_after": 15000.00,
        "processed_at": "2026-01-20T10:00:00Z",
        "created_at": "2026-01-20T10:00:00Z"
      },
      {
        "id": "txn-uuid-2",
        "user_id": "user-uuid",
        "transaction_type": "withdrawal",
        "amount": -10000.00,
        "currency": "INR",
        "status": "processing",
        "description": "Withdrawal to HDFC Bank XXXX3456",
        "reference_type": "bank_account",
        "reference_id": "account-uuid",
        "balance_after": 5000.00,
        "processed_at": null,
        "created_at": "2026-01-21T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 25,
      "totalPages": 2,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

**Transaction Types (Creator):**
- `earning` - Payment received from campaign
- `withdrawal` - Withdrawal to bank account
- `bonus` - Bonus/reward credit
- `refund` - Refund credit

**Transaction Statuses:**
- `pending` - Awaiting processing
- `processing` - Being processed
- `completed` - Successfully completed
- `failed` - Transaction failed
- `cancelled` - Cancelled by user/admin

**Auth Required:** Yes

---

### 24. Get Transaction Summary

**GET** `/api/v1/wallet/transactions/summary`

Get summary of user's transactions.

**Headers:**
| Header | Type | Required |
|--------|------|----------|
| Authorization | Bearer token | Yes |

**Response:**
```json
{
  "success": true,
  "data": {
    "total_earnings": 50000.00,
    "total_withdrawals": 35000.00,
    "pending_withdrawals": 2000.00,
    "this_month_earnings": 8000.00,
    "last_month_earnings": 12000.00,
    "transaction_count": {
      "total": 25,
      "earnings": 15,
      "withdrawals": 8,
      "pending": 2
    }
  }
}
```

**Auth Required:** Yes

---

### 25. Get Transaction by ID

**GET** `/api/v1/wallet/transactions/:id`

Get a specific transaction by ID.

**Path Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| id | string | Transaction UUID |

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "txn-uuid",
    "user_id": "user-uuid",
    "transaction_type": "earning",
    "amount": 5000.00,
    "currency": "INR",
    "status": "completed",
    "description": "Campaign payment: Summer Fashion Campaign",
    "reference_type": "campaign",
    "reference_id": "campaign-uuid",
    "balance_before": 10000.00,
    "balance_after": 15000.00,
    "metadata": {
      "campaign_title": "Summer Fashion Campaign",
      "brand_name": "Fashion Brand"
    },
    "processed_at": "2026-01-20T10:00:00Z",
    "created_at": "2026-01-20T10:00:00Z"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Transaction not found"
}
```

**Auth Required:** No (but only returns transactions for the user's own data)

---

## Withdrawal APIs

### 26. Request Withdrawal

**POST** `/api/v1/wallet/withdrawals`

Request a withdrawal to a bank account.

**Headers:**
| Header | Type | Required |
|--------|------|----------|
| Authorization | Bearer token | Yes |

**Request Body:**
```json
{
  "amount": 5000,
  "bank_account_id": "account-uuid"
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| amount | number | Yes | Amount to withdraw (min ₹100) |
| bank_account_id | string | Yes | Target bank account UUID |

**Response:**
```json
{
  "success": true,
  "data": {
    "transaction_id": "txn-uuid",
    "amount": 5000.00,
    "status": "pending",
    "bank_account": {
      "bank_name": "HDFC Bank",
      "account_number_masked": "XXXXXXXXXXXX3456"
    },
    "estimated_arrival": "2-3 business days",
    "created_at": "2026-01-20T10:00:00Z"
  }
}
```

**Error Responses:**
| Status | Error | Description |
|--------|-------|-------------|
| 400 | INSUFFICIENT_BALANCE | Not enough available balance |
| 400 | MINIMUM_AMOUNT | Amount below ₹100 minimum |
| 400 | UNVERIFIED_ACCOUNT | Bank account not verified |
| 404 | ACCOUNT_NOT_FOUND | Bank account doesn't exist |

**Auth Required:** Yes

**Notes:**
- Minimum withdrawal amount is ₹100
- Bank account must be verified by admin
- Amount is deducted from available balance immediately

---

## Admin APIs

### 27. Get Pending Bank Account Verifications

**GET** `/api/v1/wallet/admin/bank-accounts/pending`

Get list of bank accounts pending verification.

**Headers:**
| Header | Type | Required |
|--------|------|----------|
| Authorization | Bearer token (Admin) | Yes |

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
    "accounts": [
      {
        "id": "account-uuid",
        "user_id": "user-uuid",
        "user": {
          "username": "creator_name",
          "email": "creator@example.com"
        },
        "account_holder_name": "John Doe",
        "account_number": "1234567890123456",
        "ifsc_code": "HDFC0001234",
        "bank_name": "HDFC Bank",
        "verification_status": "pending",
        "created_at": "2026-01-20T10:00:00Z"
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

**Auth Required:** Admin only

---

### 28. Verify Bank Account

**POST** `/api/v1/wallet/admin/bank-accounts/:id/verify`

Verify or reject a bank account.

**Headers:**
| Header | Type | Required |
|--------|------|----------|
| Authorization | Bearer token (Admin) | Yes |

**Path Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| id | string | Bank account UUID |

**Request Body:**
```json
{
  "verified": true,
  "notes": "Verified via penny drop"
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| verified | boolean | Yes | true = verify, false = reject |
| notes | string | No | Admin notes |

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "account-uuid",
    "is_verified": true,
    "verification_status": "verified",
    "verified_at": "2026-01-20T11:00:00Z",
    "verified_by": "admin-uuid",
    "verification_notes": "Verified via penny drop"
  }
}
```

**Auth Required:** Admin only

---

### 29. Get Pending Withdrawals

**GET** `/api/v1/wallet/admin/withdrawals/pending`

Get list of pending withdrawal requests.

**Headers:**
| Header | Type | Required |
|--------|------|----------|
| Authorization | Bearer token (Admin) | Yes |

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
    "withdrawals": [
      {
        "id": "txn-uuid",
        "user_id": "user-uuid",
        "user": {
          "username": "creator_name",
          "email": "creator@example.com"
        },
        "amount": 5000.00,
        "currency": "INR",
        "status": "pending",
        "bank_account": {
          "id": "account-uuid",
          "bank_name": "HDFC Bank",
          "account_number": "1234567890123456",
          "ifsc_code": "HDFC0001234",
          "account_holder_name": "John Doe"
        },
        "created_at": "2026-01-20T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 3,
      "totalPages": 1
    }
  }
}
```

**Auth Required:** Admin only

---

### 30. Process Withdrawal

**POST** `/api/v1/wallet/admin/withdrawals/:id/process`

Process a pending withdrawal (approve/reject).

**Headers:**
| Header | Type | Required |
|--------|------|----------|
| Authorization | Bearer token (Admin) | Yes |

**Path Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| id | string | Transaction UUID |

**Request Body:**
```json
{
  "success": true,
  "external_transaction_id": "UTR123456789",
  "failure_reason": null
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| success | boolean | Yes | true = approve, false = reject |
| external_transaction_id | string | If success | Bank UTR/reference number |
| failure_reason | string | If failed | Reason for rejection |

**Success Response:**
```json
{
  "success": true,
  "data": {
    "id": "txn-uuid",
    "status": "completed",
    "external_transaction_id": "UTR123456789",
    "processed_at": "2026-01-20T12:00:00Z",
    "processed_by": "admin-uuid"
  }
}
```

**Failure Response:**
```json
{
  "success": true,
  "data": {
    "id": "txn-uuid",
    "status": "failed",
    "failure_reason": "Invalid bank account details",
    "amount_refunded": 5000.00,
    "processed_at": "2026-01-20T12:00:00Z",
    "processed_by": "admin-uuid"
  }
}
```

**Auth Required:** Admin only

**Notes:**
- If withdrawal fails, the amount is automatically refunded to user's wallet
- User receives a notification on withdrawal status change

---

## Common Error Responses

All endpoints may return these common errors:

| Status | Error | Description |
|--------|-------|-------------|
| 400 | BAD_REQUEST | Invalid request parameters |
| 401 | UNAUTHORIZED | Missing or invalid auth token |
| 403 | FORBIDDEN | Insufficient permissions |
| 404 | NOT_FOUND | Resource not found |
| 500 | INTERNAL_ERROR | Server error |

**Standard Error Response Format:**
```json
{
  "success": false,
  "message": "Error description",
  "error": "ERROR_CODE"
}
```

---

## Webhook Events

### Razorpay Webhook Events

The wallet service handles these Razorpay webhook events:

| Event | Action |
|-------|--------|
| `payment.captured` | Credit tokens/escrow for successful payment |
| `payment.failed` | Mark transaction as failed |
| `refund.created` | Process refund |

**Webhook Security:**
- All webhooks are validated using `x-razorpay-signature` header
- Signature is computed using HMAC-SHA256 with webhook secret

---

## Rate Limits

| Endpoint Type | Limit |
|---------------|-------|
| Read endpoints | 100 requests/minute |
| Write endpoints | 30 requests/minute |
| Webhook endpoints | 1000 requests/minute |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-20 | Initial documentation |
| 1.1.0 | 2026-01-25 | Added bank account, transaction, withdrawal, and admin APIs |
