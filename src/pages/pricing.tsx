import { useState, useEffect } from 'react';
import Link from 'next/link';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import AuthModal from '@/components/AuthModal';
import { loadStripe } from '@stripe/stripe-js';
import { loadPayPalScript, createPayPalOrder } from '@/lib/paypal';
import { useRouter } from 'next/router';

// Initialize Stripe outside component
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function Pricing() {
  const router = useRouter();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const { user } = useAuth();
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [error, setError] = useState(''); // Add error state

  useEffect(() => {
    fetchPlans();
    if (user) {
      fetchUserCurrentPlan();
    }
  }, [user]);

  const fetchPlans = async () => {
    try {
      const q = query(
        collection(db, 'plans'),
        where('isActive', '==', true)
      );
      const snapshot = await getDocs(q);
      setPlans(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })));
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserCurrentPlan = async () => {
    try {
      const subsQuery = query(
        collection(db, 'subscriptions'),
        where('userId', '==', user.uid),
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      
      const snapshot = await getDocs(subsQuery);
      if (!snapshot.empty) {
        setCurrentPlanId(snapshot.docs[0].data().planId);
      } else {
        // If no active subscription, set to free plan ID if it exists
        const freePlan = plans.find(p => p.price === 0);
        setCurrentPlanId(freePlan?.id || null);
      }
    } catch (error) {
      console.error('Error fetching current plan:', error);
    }
  };

  const handlePurchase = (plan) => {
    if (!user) {
      setSelectedPlan(plan);
      setShowAuthModal(true);
      return;
    }
    
    // Proceed to payment
    initiatePayment(plan);
  };

  const handlePayment = async (plan: any, gateway: 'stripe' | 'paypal') => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    try {
      setLoading(true);
      setError(''); // Clear previous errors

      if (gateway === 'paypal') {
        const paypal = await loadPayPalScript();
        if (!paypal) throw new Error('Failed to load PayPal SDK');

        const order = await createPayPalOrder({
          planId: plan.id,
          amount: plan.price,
          currency: plan.currency
        });

        // Initialize PayPal buttons
        await paypal.Buttons({
          createOrder: () => order.id,
          onApprove: async (data) => {
            // Handle successful payment
            await fetch('/api/payments/capture-paypal-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: data.orderID,
                planId: plan.id,
              })
            });
            router.push('/payment/success');
          }
        }).render('#paypal-button-container');
      } else {
        // Existing Stripe payment logic
        const response = await fetch('/api/payments/create-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId: plan.id,
            gateway: 'stripe'
          })
        });

        const { session } = await response.json();
        const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
        await stripe?.redirectToCheckout({ sessionId: session.id });
      }
    } catch (error) {
      console.error('Payment error:', error);
      setError('Failed to process payment');
    } finally {
      setLoading(false);
    }
  };

  const initiatePayment = async (plan) => {
    try {
      const response = await fetch('/api/payments/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          userId: user.uid,
          successUrl: `${window.location.origin}/payment/success`,
          cancelUrl: `${window.location.origin}/pricing`
        })
      });

      const data = await response.json();
      
      // Redirect to payment page
      window.location.href = data.url;
    } catch (error) {
      console.error('Payment error:', error);
    }
  };

  const initializePayment = async (planId: string, gateway: string) => {
    try {
      const plan = plans.find(p => p.id === planId);
      if (!plan) {
        throw new Error('Plan not found');
      }

      const response = await fetch('/api/payments/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          userId: user?.uid,
          gateway,
          amount: plan.price,
          currency: plan.currency
        })
      });

      const { session } = await response.json();

      switch (gateway) {
        case 'razorpay':
          // Initialize Razorpay
          const rzp = new (window as any).Razorpay({
            key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
            ...session
          });
          rzp.open();
          break;

        case 'paypal':
          // Handle PayPal
          const paypal = await loadPayPalScript();
          // PayPal buttons configuration
          break;

        case 'ccavenue':
          // Redirect to CCAvenue payment page
          window.location.href = session.payment_url;
          break;

        default:
          // Handle Stripe
          const stripe = await stripePromise;
          await stripe?.redirectToCheckout({ sessionId: session.id });
      }
    } catch (error) {
      console.error('Payment initialization error:', error);
    }
  };

  useEffect(() => {
    if (window.paypal) {
      window.paypal.Buttons({
        onApprove: async (data, actions) => {
          router.push('/payment/success');
        }
      }).render('#paypal-button-container');
    }
  }, [selectedPlan]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ...header and navigation... */}

      <main className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold">Choose Your Plan</h1>
          <p className="mt-4 text-xl text-gray-600">
            Select the perfect plan for your QR code needs
          </p>
        </div>

        {error && (
          <div className="text-red-600 bg-red-50 p-4 rounded-lg mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid md:grid-cols-3 gap-8 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-96 bg-white rounded-lg"></div>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <div 
                key={plan.id} 
                className={`bg-white rounded-xl shadow-sm p-8 relative
                  ${currentPlanId === plan.id ? 'ring-2 ring-blue-500' : ''}
                `}
              >
                {currentPlanId === plan.id && (
                  <div className="absolute -top-3 right-4">
                    <span className="bg-blue-500 text-white px-4 py-1 text-sm rounded-full shadow-sm">
                      Current Plan
                    </span>
                  </div>
                )}

                <h3 className="text-2xl font-bold">{plan.name}</h3>
                <p className="mt-4 text-gray-600">{plan.description}</p>
                
                <div className="mt-6">
                  <p className="text-4xl font-bold">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: plan.currency
                    }).format(plan.price)}
                  </p>
                  <p className="text-gray-500">per {plan.duration} days</p>
                </div>

                <ul className="mt-6 space-y-4">
                  {plan.features.map((feature) => (
                    <li key={feature.key} className="flex items-center">
                      <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>
                        {feature.label}: {feature.type === 'boolean' 
                          ? (feature.value ? 'Yes' : 'No')
                          : feature.value}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    // Don't allow re-purchasing current plan
                    if (currentPlanId !== plan.id) {
                      handlePurchase(plan);
                    }
                  }}
                  className={`mt-8 w-full py-3 px-4 rounded-lg text-center block
                    ${currentPlanId === plan.id
                      ? 'bg-gray-100 text-gray-500 cursor-default'
                      : 'bg-blue-600 text-white hover:bg-blue-700 transition-colors'
                    }`}
                >
                  {currentPlanId === plan.id ? 'Current Plan' : 'Get Started'}
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>

      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => {
            setShowAuthModal(false);
            if (selectedPlan) {
              initiatePayment(selectedPlan);
            }
          }}
        />
      )}
    </div>
  );
}
