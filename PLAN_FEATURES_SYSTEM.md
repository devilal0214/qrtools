# Plan Features System - Complete Guide

## Overview

All features in the QR Code Generator application are controlled by Super Admin plan settings. This document explains how the feature access system works across the entire application.

---

## Architecture

### 1. Feature Management Hook

**File:** [usePlanFeatures.ts](src/hooks/usePlanFeatures.ts)

This central hook manages ALL feature access throughout the application.

```typescript
const {
  loading,                    // Is plan data still loading?
  planName,                   // Current plan name (Free, Basic, Pro, etc.)
  features,                   // Object with all features {feature: boolean}
  qrLimit,                    // Max QR codes user can create
  qrCreated,                  // How many QR codes user has created
  remainingQRs,               // qrLimit - qrCreated
  isTrialActive,              // Is user in trial period?
  trialDaysRemaining,         // Days left in trial
  trialEndsAt,                // Trial end date
  canCreateMoreQR,            // Function: can user create more QRs?
  canUseFeature,              // Function: can user use a feature?
  canUseContentType           // Function: can user use a content type?
} = usePlanFeatures();
```

---

## Premium Features

### Defined Features

```typescript
const PREMIUM_FEATURES = [
  'tracking',          // Track QR code scans
  'removeWatermark',   // Remove watermark from QR codes
  'dynamicQR',         // Create dynamic (editable) QR codes
  'frames',            // Add decorative frames to QR codes
  'analytics',         // View analytics dashboard
  'customDomain',      // Use custom domain for tracking
  'pauseResume',       // Pause/resume QR codes
  'customization'      // Advanced QR customization
];
```

### Feature Mapping

App features are mapped to plan feature keys:

```typescript
const FEATURE_KEY_MAP = {
  'tracking': 'analytics',              // Tracking uses analytics feature
  'removeWatermark': 'customization',   // Watermark uses customization
  'dynamicQR': 'dynamic',               // Dynamic QR
  'frames': 'customization',            // Frames use customization
  'analytics': 'analytics',             // Analytics dashboard
  'customDomain': 'customDomain',       // Custom domain
  'pauseResume': 'pauseResume',         // Pause/resume
  'customization': 'customization'      // Advanced customization
};
```

---

## Feature Access Logic

### Access Hierarchy

```
1. Paid User with Active Subscription
   ├─ Read plan.features from Firestore
   ├─ Map app features to plan features
   └─ Return plan-specific access

2. Trial User (Within Trial Period)
   ├─ Calculate: now < (createdAt + trialDays)
   ├─ Enable ALL premium features
   └─ Return full access

3. Free User (No Subscription, No Active Trial)
   ├─ Disable ALL premium features
   └─ Return limited access
```

### Code Implementation

```typescript
const buildFeatures = () => {
  const featuresObj: Record<string, boolean> = {};
  
  if (planData?.features && Array.isArray(planData.features)) {
    // ✅ PAID USER: Use plan features
    const planFeatures: Record<string, boolean> = {};
    planData.features.forEach((feature: any) => {
      if (feature.type === 'boolean') {
        planFeatures[feature.key] = Boolean(feature.value);
      }
    });
    
    PREMIUM_FEATURES.forEach(appFeature => {
      const planKey = FEATURE_KEY_MAP[appFeature] || appFeature;
      featuresObj[appFeature] = planFeatures[planKey] || false;
    });
  } else if (trialStatus.isActive) {
    // ✅ TRIAL USER: Enable all premium features
    PREMIUM_FEATURES.forEach(feature => {
      featuresObj[feature] = true;
    });
  } else {
    // ❌ FREE USER: Disable all premium features
    PREMIUM_FEATURES.forEach(feature => {
      featuresObj[feature] = false;
    });
  }
  
  return featuresObj;
};
```

---

## Trial System

### Trial Calculation

```typescript
const getTrialStatus = () => {
  // No trial if no user or no creation date
  if (!user || !planData?.createdAt) {
    return { isActive: false, daysRemaining: 0, endsAt: null };
  }

  // No trial if user has active subscription
  if (planData?.subscriptionId) {
    return { isActive: false, daysRemaining: 0, endsAt: null };
  }

  // Calculate trial end date
  const createdDate = new Date(planData.createdAt);
  const trialEndDate = new Date(createdDate);
  trialEndDate.setDate(trialEndDate.getDate() + trialDays);
  
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil(
    (trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  ));

  // Trial is active ONLY if days remaining > 0
  return {
    isActive: daysRemaining > 0,
    daysRemaining,
    endsAt: trialEndDate
  };
};
```

### Trial Configuration

**Location:** Admin → Settings → Trial Settings

```typescript
// Firestore: settings/config
{
  trial: {
    enabled: true,
    durationDays: 14  // Configure trial duration (default: 14 days)
  }
}
```

---

## Implementation in Pages

### Homepage (index.tsx)

#### 1. Track Your Scans Toggle

```tsx
<button
  type="button"
  onClick={() => {
    if (!user) {
      setShowAuthModal(true);  // Must login first
      return;
    }
    if (!canUseFeature('tracking')) {
      router.push('/pricing');  // Upgrade required
      return;
    }
    setTrackScansEnabled((prev) => !prev);  // Toggle feature
  }}
  className={`relative w-10 h-5 rounded-full border flex items-center transition-colors ${
    trackScansEnabled && canUseFeature('tracking')
      ? "bg-lime-400 border-lime-300"
      : "bg-zinc-700 border-zinc-600"
  }`}
>
  {/* Toggle switch */}
</button>

<span>Track your scans {!canUseFeature('tracking') && '✨'}</span>

{/* Show trial/premium badge if feature locked */}
{!canUseFeature('tracking') && (
  <span className="text-[10px] bg-purple-500/20 text-purple-200 px-2 py-0.5 rounded-full">
    {isTrialActive ? `${trialDaysRemaining}d trial` : 'Premium'}
  </span>
)}
```

#### 2. Remove Watermark Toggle

```tsx
<button
  type="button"
  onClick={() => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (!canUseFeature('removeWatermark')) {
      router.push('/pricing');
      return;
    }
    setRemoveWatermarkEnabled((prev) => !prev);
  }}
  className={`/* same toggle style */`}
>
  {/* Toggle switch */}
</button>

<span>Remove watermark {!canUseFeature('removeWatermark') && '✨'}</span>

{!canUseFeature('removeWatermark') && (
  <span className="text-[10px] bg-purple-500/20 text-purple-200 px-2 py-0.5 rounded-full">
    {isTrialActive ? `${trialDaysRemaining}d trial` : 'Premium'}
  </span>
)}
```

#### 3. Frames Tab (Premium Feature)

```tsx
{/* Design tabs */}
<div className="flex gap-2">
  {[
    { key: "FRAME", label: "Frames ✨", premium: true },
    { key: "SHAPE", label: "Shape", premium: false },
    { key: "LOGO", label: "Logo", premium: false },
  ].map((tab) => (
    <button
      key={tab.key}
      onClick={() => {
        // ✅ Check feature access before allowing tab switch
        if (tab.premium && !canUseFeature('frames')) {
          router.push('/pricing');
          return;
        }
        setDesignTab(tab.key as DesignTab);
      }}
      className={`/* tab styles */`}
    >
      {tab.label}
      {/* Show premium indicator if locked */}
      {tab.premium && !canUseFeature('frames') && (
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full"></span>
      )}
    </button>
  ))}
</div>

{/* Frame tab content */}
{designTab === "FRAME" && (
  <div className="space-y-3 relative">
    {/* ✅ Premium overlay - CRITICAL: Check planLoading */}
    {!planLoading && !canUseFeature('frames') && (
      <div className="absolute inset-0 bg-zinc-900/80 backdrop-blur-sm rounded-2xl z-10">
        <div className="text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-white font-semibold mb-1">Premium Feature</h3>
          <p className="text-zinc-300 text-xs mb-3">
            Unlock beautiful frames with premium
          </p>
          <button
            onClick={() => router.push('/pricing')}
            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 rounded-full text-sm font-semibold hover:from-purple-600 hover:to-pink-600 transition-all"
          >
            Upgrade Now
          </button>
        </div>
      </div>
    )}
    
    {/* Frame selection buttons */}
    <div className="flex gap-3 overflow-x-auto scrollbar-hide py-1">
      {FRAME_PRESETS.map((preset) => (
        <button
          key={preset.id}
          onClick={() => canUseFeature('frames') && setFrameStyle(preset.id)}
          disabled={!canUseFeature('frames')}
          className={`/* button styles */ ${!canUseFeature('frames') ? 'opacity-50' : ''}`}
        >
          {renderFrameThumbnail(preset)}
          <span className="text-[10px] text-zinc-200 mt-1">{preset.label}</span>
        </button>
      ))}
    </div>
  </div>
)}
```

**CRITICAL FIX:** The frame overlay now checks `!planLoading` first. This prevents showing the lock screen during initial data load when `canUseFeature('frames')` temporarily returns `false` before trial/plan data is loaded.

---

### Dashboard (/dashboard/index.tsx)

```tsx
const { 
  planName, 
  features, 
  remainingQRs,
  qrLimit,
  isTrialActive, 
  trialDaysRemaining,
  canUseFeature 
} = usePlanFeatures();

{/* Trial Banner */}
{isTrialActive && (
  <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl p-6">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-lg font-bold mb-1">🎉 Premium Trial Active</h3>
        <p className="text-purple-100">
          {trialDaysRemaining} {trialDaysRemaining === 1 ? 'day' : 'days'} remaining
        </p>
      </div>
      <Link href="/pricing" className="bg-white text-purple-600 px-6 py-2 rounded-full">
        Upgrade Now
      </Link>
    </div>
  </div>
)}

{/* Premium Features Card */}
<div className="bg-white p-6 rounded-xl shadow-sm">
  <h3 className="text-sm font-medium text-gray-600 mb-2">Premium Features</h3>
  <div className="space-y-2">
    {['tracking', 'removeWatermark', 'frames'].map(feature => (
      <div key={feature} className="flex items-center gap-2 text-sm">
        {canUseFeature(feature) ? (
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
        <span className={canUseFeature(feature) ? 'text-gray-700' : 'text-gray-400'}>
          {feature.charAt(0).toUpperCase() + feature.slice(1).replace(/([A-Z])/g, ' $1')}
        </span>
      </div>
    ))}
  </div>
</div>
```

---

### Dashboard Active QR Codes (/dashboard/active.tsx)

The dashboard QR creation wizard doesn't need premium overlays because:
1. Users are already authenticated
2. Features are enabled based on their plan
3. Frame/shape/logo selections work automatically based on `canUseFeature()`

```tsx
// Step 2: Frame selection (automatically respects plan features)
const renderStep2 = () => {
  const frameOptions: { key: FrameStyle; label: string }[] = [
    { key: "none", label: "None" },
    { key: "soft-card", label: "Soft card" },
    { key: "gradient", label: "Gradient" },
    { key: "dark-badge", label: "Dark badge" },
  ];

  return (
    <div>
      {/* Frame buttons - no premium check needed */}
      {frameOptions.map((opt) => (
        <button
          key={opt.key}
          onClick={() => setFrameStyle(opt.key)}
          className={`/* styles */`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};
```

---

## Super Admin Controls

### Plans Management

**Location:** Admin → Plans

Super Admin can create/edit plans with custom features:

```typescript
// Plan structure in Firestore
{
  name: "Pro Plan",
  price: 29,
  currency: "USD",
  interval: "month",
  qrLimit: 1000,
  enabledContentTypes: [
    "URL", "PLAIN_TEXT", "CONTACT", "EMAIL", 
    "PHONE", "SMS", "WIFI", "LOCATION", "MULTI_URL"
  ],
  features: [
    { key: "qrLimit", label: "QR Code Limit", value: 1000, type: "number" },
    { key: "analytics", label: "Analytics", value: true, type: "boolean" },
    { key: "customization", label: "Customization", value: true, type: "boolean" },
    { key: "dynamic", label: "Dynamic QR", value: true, type: "boolean" },
    { key: "customDomain", label: "Custom Domain", value: true, type: "boolean" },
    { key: "pauseResume", label: "Pause/Resume", value: true, type: "boolean" }
  ]
}
```

### Trial Settings

**Location:** Admin → Settings → Trial Settings

```typescript
// Firestore: settings/config
{
  trial: {
    enabled: true,
    durationDays: 14  // Can be changed (7, 14, 30, etc.)
  }
}
```

### Free Plan Configuration

**Location:** Admin → Settings → Free Tier

```typescript
// Firestore: settings/config
{
  freeTier: {
    name: "Free",
    qrLimit: 5,
    enabledContentTypes: ["URL", "PLAIN_TEXT"],
    features: [
      { key: "qrLimit", label: "QR Code Limit", value: 5, type: "number" },
      { key: "analytics", label: "Analytics", value: false, type: "boolean" },
      { key: "customization", label: "Customization", value: false, type: "boolean" },
      { key: "dynamic", label: "Dynamic QR", value: false, type: "boolean" }
    ]
  }
}
```

---

## Content Type Access

### Enabled Content Types

Each plan defines which content types users can create QR codes for:

```typescript
// Example: Pro plan enables all types
enabledContentTypes: [
  "URL",          // Website links
  "PLAIN_TEXT",   // Plain text
  "CONTACT",      // vCard contact
  "EMAIL",        // Email address
  "PHONE",        // Phone number
  "SMS",          // SMS message
  "WIFI",         // WiFi credentials
  "LOCATION",     // Geographic location
  "MULTI_URL"     // Multiple URLs (premium)
]

// Example: Free plan enables only basic types
enabledContentTypes: [
  "URL",
  "PLAIN_TEXT"
]
```

### Checking Content Type Access

```tsx
const canCreate = canUseContentType('MULTI_URL');

if (!canCreate) {
  // Show upgrade message or redirect to pricing
  router.push('/pricing');
}
```

---

## Feature Access Patterns

### Pattern 1: Toggle Features (Track, Watermark)

```tsx
const handleToggle = () => {
  // 1. Check if user is logged in
  if (!user) {
    setShowAuthModal(true);
    return;
  }
  
  // 2. Check if user has feature access
  if (!canUseFeature('tracking')) {
    router.push('/pricing');
    return;
  }
  
  // 3. Toggle the feature
  setTrackScansEnabled((prev) => !prev);
};
```

### Pattern 2: Tab-Based Features (Frames)

```tsx
const handleTabClick = (tab) => {
  // Check feature access before switching tabs
  if (tab.premium && !canUseFeature('frames')) {
    router.push('/pricing');
    return;
  }
  
  setDesignTab(tab.key);
};
```

### Pattern 3: Premium Overlays

```tsx
{/* Show overlay only if not loading AND feature locked */}
{!planLoading && !canUseFeature('frames') && (
  <div className="absolute inset-0 bg-zinc-900/80 backdrop-blur-sm z-10">
    <div className="text-center">
      <h3>Premium Feature</h3>
      <p>Unlock with premium</p>
      <button onClick={() => router.push('/pricing')}>
        Upgrade Now
      </button>
    </div>
  </div>
)}
```

### Pattern 4: Button States

```tsx
<button
  onClick={() => canUseFeature('frames') && handleAction()}
  disabled={!canUseFeature('frames')}
  className={`button-base ${!canUseFeature('frames') ? 'opacity-50' : ''}`}
>
  Select Frame
</button>
```

---

## Common Issues & Solutions

### Issue 1: Feature Locked During Active Trial

**Symptom:** Trial is active but features show as locked

**Cause:** UI checking feature access before plan data loads

**Solution:** Always check `planLoading` before showing lock UI
```tsx
{!planLoading && !canUseFeature('frames') && (
  <div>Feature Locked</div>
)}
```

### Issue 2: Trial Shows Wrong Days Remaining

**Symptom:** Trial days calculation incorrect

**Cause:** Trial calculation using wrong date or timezone

**Solution:** Ensure createdAt is stored in UTC ISO format
```typescript
createdAt: new Date().toISOString()
```

### Issue 3: Paid User Seeing Trial Banner

**Symptom:** User with subscription sees trial status

**Cause:** Trial calculation not checking subscriptionId

**Solution:** Check subscription first in getTrialStatus()
```typescript
if (planData?.subscriptionId) {
  return { isActive: false, daysRemaining: 0, endsAt: null };
}
```

### Issue 4: Features Not Matching Plan

**Symptom:** User has premium plan but features locked

**Cause:** Feature mapping incorrect or plan features missing

**Solution:** Verify FEATURE_KEY_MAP and plan.features in Firestore
```typescript
// Check mapping
'frames': 'customization',  // frames uses customization key

// Check plan document
features: [
  { key: 'customization', value: true, type: 'boolean' }
]
```

---

## Testing Checklist

### Free User (No Trial, No Subscription)
- [ ] All premium features show locked
- [ ] Clicking premium features redirects to /pricing
- [ ] QR limit shows correct (default 5)
- [ ] No trial banner visible
- [ ] Only URL and PLAIN_TEXT content types available

### Trial User (Active Trial)
- [ ] Trial banner shows with correct days remaining
- [ ] All premium features unlocked
- [ ] Track scans toggle works
- [ ] Remove watermark toggle works
- [ ] Frames tab accessible and working
- [ ] No premium lock overlays visible
- [ ] Trial badge shows next to features

### Paid User (Active Subscription)
- [ ] No trial banner
- [ ] Features match plan configuration
- [ ] QR limit matches plan qrLimit
- [ ] Content types match plan enabledContentTypes
- [ ] Plan name displays correctly
- [ ] No "Upgrade" prompts if all features enabled

### Trial Expired User
- [ ] No trial banner
- [ ] All premium features locked
- [ ] Shows "Premium" badges (not trial)
- [ ] Can still access free features
- [ ] Redirects to /pricing for premium features

---

## Summary

### ✅ Key Points

1. **ALL features controlled by Super Admin** via Plans and Settings
2. **Trial users get full premium access** during trial period
3. **Always check `planLoading`** before showing lock UI
4. **Feature mapping** connects app features to plan features
5. **Three user states:** Free, Trial, Paid
6. **Consistent checking** across all pages using `canUseFeature()`
7. **Dynamic configuration** - no hardcoded limits

### ✅ Best Practices

1. Import `usePlanFeatures` hook at the top of every page
2. Destructure only the values you need
3. Check `planLoading` before rendering premium locks
4. Use `canUseFeature()` consistently for all feature checks
5. Show trial badges during trial, premium badges after
6. Redirect to `/pricing` when features are locked
7. Update Super Admin settings to change feature access globally

---

*Last Updated: December 16, 2025*  
*Status: All Plan Features Controlled by Super Admin ✅*
