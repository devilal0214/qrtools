import { useState } from 'react';
import Head from 'next/head';
import { useAuth } from '@/hooks/useAuth';
import AuthModal from '@/components/AuthModal';

const unitTypes = {
  length: {
    meters: 1,
    kilometers: 0.001,
    miles: 0.000621371,
    feet: 3.28084,
    inches: 39.3701,
    pixels: 3779.53, // Based on 96 PPI (pixels per inch)
    points: 2834.65, // Based on 72 PPI (points per inch)
    'square feet': 10.7639,
    'square yard': 1.19599,
    gaz: 1.09361 // 1 gaz = 1 yard (traditional Indian measurement)
  },
  weight: {
    kilograms: 1,
    grams: 1000,
    pounds: 2.20462,
    ounces: 35.274
  },
  temperature: {
    celsius: 'C',
    fahrenheit: 'F',
    kelvin: 'K'
  }
};

export default function UnitConverter() {
  const { user, loading: authLoading } = useAuth();  // Add loading state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [value, setValue] = useState('');
  const [type, setType] = useState('length');
  const [fromUnit, setFromUnit] = useState('meters');

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
          <p className="text-gray-600 mb-6">Please sign in to use the Unit Converter</p>
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

  const convertAll = () => {
    if (!value) return {};
    const results = {};
    const inputValue = Number(value);

    if (type === 'temperature') {
      const units = Object.keys(unitTypes[type]);
      units.forEach(unit => {
        if (unit !== fromUnit) {
          results[unit] = handleTemperatureConversion(inputValue, fromUnit, unit);
        }
      });
    } else {
      const baseValue = inputValue / unitTypes[type][fromUnit];
      Object.entries(unitTypes[type]).forEach(([unit, conversion]) => {
        if (unit !== fromUnit) {
          results[unit] = (baseValue * conversion).toFixed(4);
        }
      });
    }
    
    return results;
  };

  const handleTemperatureConversion = (value: number, from: string, to: string) => {
    let result: number;
    
    let celsius = value;
    if (from === 'fahrenheit') {
      celsius = (value - 32) * 5/9;
    } else if (from === 'kelvin') {
      celsius = value - 273.15;
    }
    
    if (to === 'fahrenheit') {
      result = celsius * 9/5 + 32;
    } else if (to === 'kelvin') {
      result = celsius + 273.15;
    } else {
      result = celsius;
    }
    
    return result.toFixed(2);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <Head>
        <title>Unit Converter</title>
      </Head>

      <div className="w-full max-w-2xl bg-white/80 backdrop-blur-lg rounded-3xl p-8 shadow-lg">
        <h1 className="text-3xl font-bold text-center mb-8 text-blue-600">
          Unit Converter
        </h1>

        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Type</label>
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setFromUnit(Object.keys(unitTypes[e.target.value])[0]);
                }}
                className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {Object.keys(unitTypes).map(type => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">From Unit</label>
              <select
                value={fromUnit}
                onChange={(e) => setFromUnit(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {Object.keys(unitTypes[type]).map(unit => (
                  <option key={unit} value={unit}>
                    {unit.charAt(0).toUpperCase() + unit.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">Value</label>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter value"
            />
          </div>

          {value && (
            <div className="mt-8">
              <h2 className="text-lg font-medium text-gray-700 mb-4">Converted Values</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(convertAll()).map(([unit, result]) => (
                  <div key={unit} className="bg-gray-50 p-4 rounded-xl">
                    <p className="text-sm text-gray-500 capitalize">{unit}</p>
                    <p className="text-lg font-bold text-blue-600 mt-1">
                      {result} {type === 'temperature' ? '°' + unit.charAt(0).toUpperCase() : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
