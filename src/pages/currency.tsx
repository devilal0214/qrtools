import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useAuth } from '@/hooks/useAuth';
import AuthModal from '@/components/AuthModal';

const currencies = {
  USD: 'US Dollar',
  SGD: 'Singapore Dollar',
  AUD: 'Australian Dollar',
  RUB: 'Russian Ruble',
  JPY: 'Japanese Yen',
  CNY: 'Chinese Yuan',
  INR: 'Indian Rupee'
};

export default function CurrencyConverter() {
  const { user, loading: authLoading } = useAuth();  // Add loading state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [from, setFrom] = useState('USD');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rates, setRates] = useState(null);

  useEffect(() => {
    if (user) {
      fetchRates();
    }
  }, [user]);

  const fetchRates = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        'https://open.er-api.com/v6/latest/USD'
      );
      const data = await response.json();
      
      if (data.result === 'error') {
        throw new Error(data.error || 'Failed to fetch rates');
      }
      
      if (data.rates) {
        setRates(data.rates);
        const lastUpdate = new Date(data.time_last_update_utc).toLocaleString();
        console.log('Rates last updated:', lastUpdate);
      } else {
        throw new Error('No rates data received');
      }
    } catch (err) {
      setError('Failed to fetch currency rates. Please try again later.');
      console.error('Error fetching rates:', err);
    } finally {
      setLoading(false);
    }
  };

  const convertAll = () => {
    if (!rates || !amount) return {};
    const baseAmount = Number(amount);
    const results = {};
    
    Object.keys(currencies).forEach(currency => {
      if (currency !== from) {
        results[currency] = ((baseAmount / rates[from]) * rates[currency]).toFixed(2);
      }
    });
    
    return results;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Sign in Required</h2>
          <p className="text-gray-600 mb-6">Please sign in to use the Currency Converter</p>
          <button
            onClick={() => setShowAuthModal(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Sign In
          </button>
        </div>
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <Head>
        <title>Currency Converter</title>
      </Head>

      <div className="w-full max-w-2xl bg-white/80 backdrop-blur-lg rounded-3xl p-8 shadow-lg">
        <h1 className="text-3xl font-bold text-center mb-8 text-blue-600">
          Currency Converter
        </h1>

        <div className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg flex justify-between items-center">
              <span>{error}</span>
              <button 
                onClick={fetchRates}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Try Again
              </button>
            </div>
          )}
          
          {loading ? (
            <div className="text-center p-4">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Fetching rates...</p>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Amount</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Enter amount"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">From Currency</label>
                  <select
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {Object.entries(currencies).map(([code, name]) => (
                      <option key={code} value={code}>
                        {code} - {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {amount && (
                <div className="mt-8">
                  <h2 className="text-lg font-medium text-gray-700 mb-4">Converted Amounts</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.entries(convertAll()).map(([currency, value]) => (
                      <div key={currency} className="bg-gray-50 p-4 rounded-xl">
                        <p className="text-sm text-gray-500">{currencies[currency]}</p>
                        <p className="text-lg font-bold text-blue-600 mt-1">
                          {value} {currency}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
