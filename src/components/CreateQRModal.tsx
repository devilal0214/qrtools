import { useState } from 'react';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import Link from 'next/link';
import { QR_CONTENT_TYPES } from '@/types/admin';

interface CreateQRModalProps {
  onClose: () => void;
}

export default function CreateQRModal({ onClose }: CreateQRModalProps) {
  const { planName, canUseContentType, enabledContentTypes } = usePlanFeatures();
  const [selectedType, setSelectedType] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canUseContentType(selectedType)) {
      setError(`This QR code type is not available in your ${planName} plan. Please upgrade to access this feature.`);
      return;
    }

    // ... rest of submission logic
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Create QR Code</h2>
          <div className="text-sm text-gray-500">Current Plan: {planName}</div>
          <button onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              QR Code Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-lg"
              required
            >
              <option value="">Select a type</option>
              {QR_CONTENT_TYPES.map(type => (
                <option 
                  key={type.key} 
                  value={type.key}
                  disabled={!canUseContentType(type.key)}
                >
                  {type.label} {!canUseContentType(type.key) ? '(Premium)' : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedType && !canUseContentType(selectedType) && (
            <div className="p-4 bg-yellow-50 text-yellow-700 rounded-lg flex justify-between items-center">
              <span>This feature requires a higher plan level</span>
              <Link 
                href="/pricing" 
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Upgrade Now →
              </Link>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-lg">
              {error}
            </div>
          )}

          {/* Form continues... */}
        </form>
      </div>
    </div>
  );
}
