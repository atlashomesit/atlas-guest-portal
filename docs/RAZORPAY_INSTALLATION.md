# Razorpay Payment Integration - Complete Installation Guide

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Razorpay Account Setup](#razorpay-account-setup)
3. [Getting API Keys](#getting-api-keys)
4. [Environment Variables Setup](#environment-variables-setup)
5. [Code Implementation](#code-implementation)
6. [Testing](#testing)
7. [Production Setup](#production-setup)
8. [Troubleshooting](#troubleshooting)

---

## 1. Prerequisites

### Required Software
- **Node.js** 22.12.0+ (check with `node --version`)
- **npm** 10.9.2+ (check with `npm --version`)
- **Git** (for version control)
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Required Accounts
- Razorpay account (Sign up at https://razorpay.com)
- Valid business email address
- Business documents (for account verification)

### Project Requirements
- React 18.3.1+
- TypeScript 5.6.2+
- Vite 7.2.4+

---

## 2. Razorpay Account Setup

### Step 1: Create Razorpay Account

1. **Visit Razorpay Dashboard**
   - Go to: https://dashboard.razorpay.com/signup
   - Click "Sign Up"

2. **Fill Registration Form**
   - Email address
   - Password (min 8 characters)
   - Business name
   - Mobile number
   - Business type (Individual/Company)

3. **Verify Email**
   - Check your email inbox
   - Click verification link
   - Complete email verification

### Step 2: Complete Business Profile

1. **Login to Dashboard**
   - Go to: https://dashboard.razorpay.com/app/login
   - Enter credentials

2. **Complete KYC (Know Your Customer)**
   - Navigate to: **Settings → Profile**
   - Fill business details:
     - Business name
     - Business type
     - Category
     - Address
     - PAN number
     - Bank account details
   - Upload required documents:
     - PAN card
     - Bank statement
     - Business proof (if applicable)

3. **Activate Account**
   - Wait for Razorpay verification (usually 24-48 hours)
   - Check email for activation confirmation

### Step 3: Activate Test Mode (For Development)

1. **Access Test Mode**
   - In dashboard, toggle to **Test Mode** (top right)
   - Test mode allows you to test payments without real money

2. **Test Mode Features**
   - No real transactions
   - Test cards available
   - No KYC required
   - Instant activation

---

## 3. Getting API Keys

### Step 1: Access API Keys

1. **Navigate to Settings**
   - Login to Razorpay Dashboard
   - Go to: **Settings → API Keys**

2. **Generate Key Pair**
   - Click **Generate New Key Pair**
   - Enter label (e.g., "Atlas Homes Production")
   - Click **Generate**

3. **Copy Keys**
   - **Key ID** (starts with `rzp_test_` for test mode or `rzp_live_` for live mode)
   - **Key Secret** (shown only once - save it securely!)
   - ⚠️ **IMPORTANT**: Save Key Secret immediately - it won't be shown again!

### Step 2: Key Types

#### Test Mode Keys
```
Key ID: rzp_test_xxxxxxxxxxxxx
Key Secret: xxxxxxxxxxxxxxxxxxxxxxxx
```
- Use for development/testing
- No real money transactions
- Instant activation

#### Live Mode Keys
```
Key ID: rzp_live_xxxxxxxxxxxxx
Key Secret: xxxxxxxxxxxxxxxxxxxxxxxx
```
- Use for production
- Real money transactions
- Requires account activation

---

## 4. Environment Variables Setup

### Step 1: Create Environment File

1. **Create `.env` file** in project root:
   ```bash
   cd RatebotaiRepo
   touch .env
   ```

2. **Add Razorpay Key**:
   ```env
   # Razorpay Configuration
   VITE_RAZORPAY_KEY_ID=rzp_test_1DP5mmOlF5G5ag
   ```

   ⚠️ **Replace with your actual Key ID from Razorpay Dashboard**

### Step 2: Environment File Structure

**`.env` (Development - Test Mode)**
```env
# Razorpay Test Mode
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx

# Other environment variables
VITE_API_BASE_URL=http://localhost:3000
VITE_EMAILJS_SERVICE_ID=your_service_id
VITE_EMAILJS_TEMPLATE_ID=your_template_id
VITE_EMAILJS_PUBLIC_KEY=your_public_key
VITE_OWNER_EMAIL=owner@example.com
```

**`.env.production` (Production - Live Mode)**
```env
# Razorpay Live Mode
VITE_RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxx

# Production API
VITE_API_BASE_URL=https://api.production.com
```

### Step 3: Add to `.gitignore`

Ensure `.env` is in `.gitignore`:
```gitignore
# Environment variables
.env
.env.local
.env.production
.env.*.local
```

### Step 4: TypeScript Configuration

The environment variable is already configured in `src/vite-env.d.ts`:
```typescript
interface ImportMetaEnv {
  readonly VITE_RAZORPAY_KEY_ID?: string;
}
```

---

## 5. Code Implementation

### Step 1: Verify TypeScript Declaration

**File:** `src/components/homepage_components/hotelBooking_form/BookingCard.tsx`

The global Razorpay type is already declared:
```typescript
declare global {
  interface Window {
    Razorpay: any;
  }
}
```

### Step 2: Script Loading (Already Implemented)

**Location:** `BookingCard.tsx` lines 201-231

The script loader is already implemented:
```typescript
useEffect(() => {
  const loadRazorpay = () => {
    if (window.Razorpay) {
      setIsRazorpayReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      setIsRazorpayReady(true);
    };
    script.onerror = () => {
      console.error('Failed to load Razorpay script');
      setIsRazorpayReady(false);
    };
    document.body.appendChild(script);
  };

  loadRazorpay();
}, []);
```

### Step 3: Payment Initialization (Already Implemented)

**Location:** `BookingCard.tsx` lines 714-790

Payment initialization is already implemented:
```typescript
const initiatePayment = () => {
  // ... validation code ...

  // Get Razorpay Key ID from environment
  const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_1DP5mmOlF5G5ag';

  // Initialize Razorpay Checkout
  const razorpayOptions = {
    key: razorpayKeyId,
    amount: Math.round(totalPrice * 100), // Amount in paise
    currency: 'INR',
    name: property?.property_name || 'Atlas Homestays',
    description: `Booking for ${bookingSummary.checkIn} to ${bookingSummary.checkOut}`,
    prefill: {
      email: autoEmail,
      contact: autoPhone,
      name: autoEmail.split('@')[0],
    },
    notes: {
      bookingId,
      propertyId: String(propertyId),
      checkIn: bookingSummary.checkIn,
      checkOut: bookingSummary.checkOut,
      guests: bookingSummary.guests,
      nights: String(nights),
      total: String(totalPrice),
    },
    handler: function (response: any) {
      // Payment success callback
      console.log('[Razorpay] Payment successful:', response);
      setPaymentStatus({
        state: 'success',
        paymentId: response.razorpay_payment_id,
        bookingId,
      });
    },
    modal: {
      ondismiss: function () {
        // Payment cancelled
        setIsLoading(false);
        setPaymentStatus({
          state: 'failure',
          reason: 'Payment was cancelled',
        });
      },
    },
  };

  const razorpay = new window.Razorpay(razorpayOptions);
  razorpay.open();
};
```

### Step 4: Verify Dependencies

**No npm packages required!** Razorpay is loaded via CDN script.

However, if you want TypeScript types:
```bash
npm install --save-dev @types/razorpay
```

---

## 6. Testing

### Step 1: Start Development Server

```bash
cd RatebotaiRepo
npm install
npm run dev
```

### Step 2: Test Payment Flow

1. **Navigate to Property Page**
   - Go to: http://localhost:5173/property_details/atlas-homes-room-101
   - Or any property detail page

2. **Fill Booking Form**
   - Select dates
   - Select guests
   - Enter email and phone
   - Accept terms & conditions

3. **Click "Book Now / Pay"**
   - Razorpay popup should open
   - Form should be pre-filled with email/phone

### Step 3: Test Cards (Test Mode)

Use these test cards in Razorpay checkout:

#### Success Cards
```
Card Number: 4111 1111 1111 1111
CVV: Any 3 digits (e.g., 123)
Expiry: Any future date (e.g., 12/25)
Name: Any name
```

#### Failure Cards
```
Card Number: 4000 0000 0000 0002
CVV: Any 3 digits
Expiry: Any future date
Name: Any name
```
This will show payment failure.

### Step 4: Test UPI

In test mode, use:
- **UPI ID**: `success@razorpay` (for success)
- **UPI ID**: `failure@razorpay` (for failure)

### Step 5: Verify Console Logs

Open browser DevTools (F12) and check:
- `[Razorpay] Checkout opened` - Script loaded
- `[Razorpay] Payment successful` - Payment completed
- `[Razorpay] Payment modal closed` - User cancelled

---

## 7. Production Setup

### Step 1: Switch to Live Mode

1. **Get Live Mode Keys**
   - Login to Razorpay Dashboard
   - Switch to **Live Mode** (top right toggle)
   - Go to: **Settings → API Keys**
   - Generate new key pair (if not already done)
   - Copy **Live Key ID** (starts with `rzp_live_`)

2. **Update Environment Variables**
   - In your hosting platform (Cloudflare Pages, Vercel, etc.)
   - Add environment variable:
     ```
     VITE_RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxx
     ```

### Step 2: Cloudflare Pages Setup

1. **Navigate to Project Settings**
   - Go to: Cloudflare Dashboard → Pages → Your Project
   - Click **Settings → Environment variables**

2. **Add Production Variable**
   - **Variable name:** `VITE_RAZORPAY_KEY_ID`
   - **Value:** `rzp_live_xxxxxxxxxxxxx`
   - **Environment:** Production
   - Click **Save**

3. **Add Preview Variable** (Optional)
   - Same variable for Preview environment
   - Use test mode key for preview builds

### Step 3: Verify Production Build

```bash
npm run build
npm run preview
```

Test the production build locally before deploying.

### Step 4: Webhook Setup (Optional - For Server-Side Verification)

If you have a backend server, set up webhooks:

1. **In Razorpay Dashboard**
   - Go to: **Settings → Webhooks**
   - Click **Add New Webhook**
   - **URL:** `https://your-api.com/webhooks/razorpay`
   - **Events:** Select `payment.captured`, `payment.failed`
   - Click **Create**

2. **Verify Webhook Signature**
   ```javascript
   // Backend example (Node.js)
   const crypto = require('crypto');
   
   function verifyWebhookSignature(webhookBody, signature, secret) {
     const expectedSignature = crypto
       .createHmac('sha256', secret)
       .update(webhookBody)
       .digest('hex');
     
     return expectedSignature === signature;
   }
   ```

---

## 8. Troubleshooting

### Issue 1: "Payment system is loading"

**Symptoms:**
- Button shows "Payment system is loading"
- Razorpay popup doesn't open

**Solutions:**
1. Check browser console for errors
2. Verify script is loading:
   ```javascript
   console.log(window.Razorpay); // Should not be undefined
   ```
3. Check network tab for `checkout.js` request
4. Clear browser cache and reload
5. Check if ad blocker is blocking the script

### Issue 2: "Invalid Key ID"

**Symptoms:**
- Error: "Invalid key_id"
- Payment popup shows error

**Solutions:**
1. Verify `.env` file exists in project root
2. Check environment variable name: `VITE_RAZORPAY_KEY_ID`
3. Verify key ID format:
   - Test: `rzp_test_xxxxxxxxxxxxx`
   - Live: `rzp_live_xxxxxxxxxxxxx`
4. Restart dev server after changing `.env`
5. Check for typos in key ID

### Issue 3: Script Not Loading

**Symptoms:**
- `window.Razorpay` is undefined
- Console shows script load error

**Solutions:**
1. Check internet connection
2. Verify URL: `https://checkout.razorpay.com/v1/checkout.js`
3. Check browser console for CORS errors
4. Try loading script manually in console:
   ```javascript
   const script = document.createElement('script');
   script.src = 'https://checkout.razorpay.com/v1/checkout.js';
   document.body.appendChild(script);
   ```

### Issue 4: Payment Success Not Detected

**Symptoms:**
- Payment completes but status doesn't update
- Handler callback not firing

**Solutions:**
1. Check browser console for errors
2. Verify handler function is defined correctly
3. Check if `response.razorpay_payment_id` exists
4. Add more logging:
   ```typescript
   handler: function (response: any) {
     console.log('Full response:', response);
     console.log('Payment ID:', response.razorpay_payment_id);
     // ... rest of handler
   }
   ```

### Issue 5: Environment Variable Not Working

**Symptoms:**
- `import.meta.env.VITE_RAZORPAY_KEY_ID` is undefined
- Using fallback key

**Solutions:**
1. Ensure variable starts with `VITE_`
2. Restart dev server after changing `.env`
3. Check file location: `.env` should be in project root
4. Verify no spaces around `=` in `.env`:
   ```env
   # ✅ Correct
   VITE_RAZORPAY_KEY_ID=rzp_test_xxx
   
   # ❌ Wrong
   VITE_RAZORPAY_KEY_ID = rzp_test_xxx
   ```

### Issue 6: Amount Calculation Error

**Symptoms:**
- Payment shows wrong amount
- Amount is 0 or NaN

**Solutions:**
1. Verify `totalPrice` is a number:
   ```typescript
   console.log('Total Price:', totalPrice, typeof totalPrice);
   ```
2. Check amount calculation:
   ```typescript
   amount: Math.round(totalPrice * 100) // Should be in paise
   ```
3. Ensure `totalPrice > 0`

### Common Debugging Steps

1. **Check Browser Console**
   - Open DevTools (F12)
   - Look for errors or warnings
   - Check Network tab for failed requests

2. **Verify Environment Variables**
   ```bash
   # In terminal
   echo $VITE_RAZORPAY_KEY_ID
   
   # Or in browser console
   console.log(import.meta.env.VITE_RAZORPAY_KEY_ID);
   ```

3. **Test Script Loading**
   ```javascript
   // In browser console
   console.log('Razorpay loaded:', typeof window.Razorpay);
   ```

4. **Check Razorpay Dashboard**
   - Verify account is activated
   - Check API keys are correct
   - Verify test/live mode matches your code

---

## 9. Security Best Practices

### ✅ DO:
- Store Key ID in environment variables (never in code)
- Use test mode for development
- Verify payments on backend (webhooks)
- Use HTTPS in production
- Keep Key Secret on server only (never in frontend)

### ❌ DON'T:
- Commit `.env` file to Git
- Hardcode API keys in source code
- Share Key Secret publicly
- Use live keys in development
- Trust frontend payment status alone

---

## 10. Additional Resources

### Official Documentation
- **Razorpay Docs:** https://razorpay.com/docs/
- **Checkout Integration:** https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/
- **Test Cards:** https://razorpay.com/docs/payments/test-cards/

### Support
- **Razorpay Support:** support@razorpay.com
- **Dashboard:** https://dashboard.razorpay.com
- **Status Page:** https://status.razorpay.com

---

## 11. Quick Reference

### Environment Variable
```env
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
```

### Script URL
```javascript
'https://checkout.razorpay.com/v1/checkout.js'
```

### Minimum Payment Options
```typescript
{
  key: 'rzp_test_xxx',
  amount: 10000, // in paise (₹100)
  currency: 'INR',
  name: 'Your Business Name',
  handler: function(response) {
    // Success callback
  }
}
```

### Test Card
```
Card: 4111 1111 1111 1111
CVV: 123
Expiry: 12/25
```

---

## Summary

✅ **Installation Complete!**

Your Razorpay integration is now set up. The implementation includes:
- ✅ Dynamic script loading
- ✅ Payment initialization
- ✅ Success/failure handling
- ✅ User-friendly error messages
- ✅ Environment variable configuration

**Next Steps:**
1. Test with test cards
2. Switch to live mode for production
3. Set up webhooks (if needed)
4. Monitor payments in Razorpay Dashboard

For issues, refer to the Troubleshooting section above.

