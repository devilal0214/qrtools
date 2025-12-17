# Plan Features Update - December 2025

## Overview
Updated the platform to ensure paid users have access to features **strictly according to their Super Admin plan settings** - no more, no less.

---

## Changes Made

### 1. ✅ Plan Feature Access Control

**File:** [usePlanFeatures.ts](src/hooks/usePlanFeatures.ts)

**Problem:**
- Previously, the system only checked if a user had premium access (subscription OR trial)
- All premium users got the same features regardless of their specific plan
- Paid users couldn't be restricted to specific features based on plan

**Solution:**
- Added `buildFeatures()` function that reads actual plan features from Firestore
- Maps app feature names to plan feature keys using `FEATURE_KEY_MAP`
- Checks individual feature values from plan document

**Feature Mapping:**
```typescript
const FEATURE_KEY_MAP = {
  'tracking': 'analytics',          // Scan tracking
  'removeWatermark': 'customization', // Remove watermark
  'dynamicQR': 'dynamic',            // Dynamic QR codes
  'frames': 'customization',         // Custom frames
  'analytics': 'analytics',          // Analytics dashboard
  'customDomain': 'customDomain',    // Custom domain
  'pauseResume': 'pauseResume',      // Pause/Resume QR
  'customization': 'customization'   // General customization
};
```

**How It Works:**

1. **For Paid Users (Active Subscription):**
   ```typescript
   // Reads features from plan document
   if (planData?.features && Array.isArray(planData.features)) {
     planData.features.forEach((feature) => {
       if (feature.type === 'boolean') {
         planFeatures[feature.key] = Boolean(feature.value);
       }
     });
     // Maps to app feature names
     PREMIUM_FEATURES.forEach(appFeature => {
       const planKey = FEATURE_KEY_MAP[appFeature] || appFeature;
       featuresObj[appFeature] = planFeatures[planKey] || false;
     });
   }
   ```

2. **For Trial Users:**
   ```typescript
   // Enable all premium features during trial
   PREMIUM_FEATURES.forEach(feature => {
     featuresObj[feature] = true;
   });
   ```

3. **For Free Users:**
   ```typescript
   // Disable all premium features
   PREMIUM_FEATURES.forEach(feature => {
     featuresObj[feature] = false;
   });
   ```

**QR Limit Handling:**
```typescript
const getQRLimit = () => {
  if (planData?.features && Array.isArray(planData.features)) {
    const qrLimitFeature = planData.features.find((f) => f.key === 'qrLimit');
    if (qrLimitFeature) {
      return Number(qrLimitFeature.value) || FREE_QR_LIMIT;
    }
  }
  return planData?.qrLimit || FREE_QR_LIMIT;
};
```

---

### 2. ✅ Pricing Page Button Update

**File:** [pricing.tsx](src/pages/pricing.tsx#L375)

**Change:**
```diff
- {currentPlanId === plan.id ? 'Current Plan' : 'Get Started'}
+ {currentPlanId === plan.id ? 'Current Plan' : (user ? 'Upgrade' : 'Get Started')}
```

**Behavior:**
- **Not signed in:** Shows "Get Started"
- **Signed in:** Shows "Upgrade"
- **Current plan:** Shows "Current Plan" (disabled)

---

## Plan Configuration in Super Admin

### Creating/Editing Plans

Admin can configure plans in **Admin → Plans** with these features:

**Boolean Features:**
- `analytics` - Access to analytics dashboard and tracking
- `customization` - QR customization (frames, watermark removal)
- `dynamic` - Dynamic QR codes (update without reprint)
- `pauseResume` - Pause/Resume QR functionality
- `scheduling` - Schedule QR activation
- `password` - Password protection for QR codes

**Number Features:**
- `qrLimit` - Maximum number of QR codes allowed

**Content Types:**
- Control which QR types users can create
- Examples: URL, TEXT, VCARD, EMAIL, SMS, WIFI, SOCIALS, etc.

### Example Plan Configurations

#### Basic Plan ($5/month)
```json
{
  "name": "Basic",
  "price": 5,
  "features": [
    { "key": "qrLimit", "value": 25, "type": "number" },
    { "key": "analytics", "value": true, "type": "boolean" },
    { "key": "customization", "value": false, "type": "boolean" },
    { "key": "dynamic", "value": false, "type": "boolean" }
  ],
  "enabledContentTypes": ["URL", "TEXT", "CONTACT"]
}
```
**Users Get:**
- 25 QR codes
- Tracking & analytics
- NO watermark removal
- NO dynamic QR
- Only URL, TEXT, CONTACT types

#### Pro Plan ($15/month)
```json
{
  "name": "Pro",
  "price": 15,
  "features": [
    { "key": "qrLimit", "value": 100, "type": "number" },
    { "key": "analytics", "value": true, "type": "boolean" },
    { "key": "customization", "value": true, "type": "boolean" },
    { "key": "dynamic", "value": true, "type": "boolean" },
    { "key": "pauseResume", "value": true, "type": "boolean" }
  ],
  "enabledContentTypes": ["URL", "TEXT", "CONTACT", "EMAIL", "SMS", "WIFI", "SOCIALS"]
}
```
**Users Get:**
- 100 QR codes
- Full tracking & analytics
- Watermark removal
- Dynamic QR codes
- Pause/Resume capability
- All content types except PDF/FILE

#### Enterprise Plan ($50/month)
```json
{
  "name": "Enterprise",
  "price": 50,
  "features": [
    { "key": "qrLimit", "value": 500, "type": "number" },
    { "key": "analytics", "value": true, "type": "boolean" },
    { "key": "customization", "value": true, "type": "boolean" },
    { "key": "dynamic", "value": true, "type": "boolean" },
    { "key": "pauseResume", "value": true, "type": "boolean" },
    { "key": "scheduling", "value": true, "type": "boolean" },
    { "key": "password", "value": true, "type": "boolean" }
  ],
  "enabledContentTypes": ["ALL"]
}
```
**Users Get:**
- 500 QR codes
- All features enabled
- All content types

---

## Feature Usage in Code

### Checking Feature Access

**In Components:**
```typescript
import { usePlanFeatures } from '@/hooks/usePlanFeatures';

function MyComponent() {
  const { canUseFeature } = usePlanFeatures();
  
  // Check if user can access feature
  if (canUseFeature('tracking')) {
    // Show tracking interface
  }
  
  if (canUseFeature('dynamicQR')) {
    // Allow dynamic QR creation
  }
  
  if (canUseFeature('removeWatermark')) {
    // Hide watermark
  }
}
```

**Content Type Restrictions:**
```typescript
const { canUseContentType } = usePlanFeatures();

if (canUseContentType('VCARD')) {
  // Allow vCard creation
}

if (canUseContentType('PDF')) {
  // Allow PDF QR
}
```

**QR Creation Limits:**
```typescript
const { qrCreated, qrLimit, remainingQRs, canCreateMoreQR } = usePlanFeatures();

console.log(`Created: ${qrCreated}/${qrLimit}`);
console.log(`Remaining: ${remainingQRs}`);

if (canCreateMoreQR()) {
  // Allow QR creation
} else {
  // Show upgrade prompt
}
```

---

## Testing Scenarios

### Test 1: Paid User with Limited Plan
1. Create plan with only `analytics: true`, `dynamic: false`
2. User subscribes to plan
3. User should be able to:
   - ✅ Track QR scans
   - ✅ View analytics
4. User should NOT be able to:
   - ❌ Create dynamic QR codes
   - ❌ Use custom frames
   - ❌ Remove watermark

### Test 2: Paid User with Full Plan
1. Create plan with all features enabled
2. User subscribes to plan
3. User should access all features per plan settings

### Test 3: QR Limit Enforcement
1. Create plan with `qrLimit: 10`
2. User creates 10 QR codes
3. Attempt to create 11th QR code
4. Should show upgrade prompt

### Test 4: Content Type Restrictions
1. Create plan with only `["URL", "TEXT"]` content types
2. User tries to create VCARD QR
3. Should be blocked or show upgrade prompt

### Test 5: Pricing Page Button
1. Not logged in → "Get Started"
2. Login → "Upgrade"
3. On current plan → "Current Plan" (disabled)

---

## Database Structure

### plans Collection
```typescript
{
  id: "plan_basic_001",
  name: "Basic",
  price: 5,
  currency: "USD",
  duration: 30,
  isActive: true,
  description: "Perfect for individuals",
  features: [
    {
      key: "qrLimit",
      label: "QR Code Limit",
      value: 25,
      type: "number"
    },
    {
      key: "analytics",
      label: "Analytics",
      value: true,
      type: "boolean"
    },
    {
      key: "customization",
      label: "Customization",
      value: false,
      type: "boolean"
    }
  ],
  enabledContentTypes: ["URL", "TEXT", "CONTACT"]
}
```

### subscriptions Collection
```typescript
{
  id: "sub_001",
  userId: "user_123",
  planId: "plan_basic_001",
  status: "active",
  startDate: "2025-12-01",
  endDate: "2025-12-31",
  createdAt: Timestamp
}
```

---

## Benefits

### ✅ Granular Control
- Admin can create unlimited plan tiers
- Each plan can have unique feature combinations
- No code changes needed for new plans

### ✅ Accurate Feature Access
- Users get exactly what they paid for
- No accidental access to premium features
- No locked features they should have

### ✅ Better UX
- Clear "Upgrade" button for existing users
- "Get Started" for new visitors
- Current plan clearly marked

### ✅ Flexible Pricing
- Create plans with specific feature sets
- Test different pricing strategies
- Offer specialty plans (e.g., "Analytics Only", "Dynamic QR Only")

---

## Migration Notes

### Existing Users
- Users with active subscriptions will automatically use their plan features
- Trial users continue to have all features enabled
- Free users remain on free tier

### Existing Plans
- Plans without feature arrays will use default limits
- QR limits fall back to `planData.qrLimit` field
- Content types fall back to `["URL", "PLAIN_TEXT"]`

---

## Summary

✅ **Paid users now have access strictly according to their plan settings**
✅ **Pricing page shows "Upgrade" for signed-in users**
✅ **Feature access is granular and configurable**
✅ **QR limits enforced from plan settings**
✅ **Content type restrictions work per plan**
✅ **No code changes needed for new plans**

---

*Updated: December 16, 2025*
