import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Plan, PlanFeature, QR_CONTENT_TYPES, DEFAULT_PLAN_FEATURES } from '@/types/admin';

const CURRENCIES = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
  { value: 'INR', label: 'INR' },
  { value: 'CAD', label: 'CAD' },
  { value: 'AUD', label: 'AUD' },
  { value: 'CNY', label: 'CNY' },
  { value: 'RUB', label: 'RUB' }
];

interface AddEditPlanModalProps {
  plan?: Plan;
  onClose: () => void;
  onSave: (plan: Partial<Plan>) => Promise<void>;
}

export default function AddEditPlanModal({ plan, onClose, onSave }: AddEditPlanModalProps) {
  const [formData, setFormData] = useState({
    name: plan?.name || '',
    description: plan?.description || '',
    price: plan?.price || 0,
    currency: plan?.currency || 'USD',
    duration: plan?.duration || 30,
    isActive: plan?.isActive ?? true,
    enabledContentTypes: plan?.enabledContentTypes || ['URL'], // Default to only URL
    features: plan?.features || [
      { key: 'qrLimit', label: 'QR Code Limit', value: 5, type: 'number' },
      { key: 'analytics', label: 'Analytics Access', value: false, type: 'boolean' },
      { key: 'customization', label: 'QR Customization', value: false, type: 'boolean' },
      { key: 'dynamic', label: 'Dynamic QR', value: false, type: 'boolean' },
      { key: 'pauseResume', label: 'Pause/Resume QR', value: false, type: 'boolean' }
    ]
  });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Structure the plan data correctly
      const planData = {
        name: formData.name,
        description: formData.description,
        price: Number(formData.price),
        currency: formData.currency,
        duration: Number(formData.duration),
        isActive: formData.isActive,
        enabledContentTypes: formData.enabledContentTypes,
        features: formData.features.map(f => ({
          key: f.key,
          label: f.label,
          value: f.type === 'boolean' ? Boolean(f.value) : Number(f.value),
          type: f.type
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      console.log('Saving plan with data:', planData);
      await onSave(planData);
      onClose();
    } catch (error) {
      console.error('Error saving plan:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">{plan ? 'Edit Plan' : 'Add New Plan'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Price</label>
              <div className="mt-1 flex gap-2">
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  className="flex-1 px-3 py-2 border rounded-lg"
                  min="0"
                  step="0.01"
                  required
                />
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="px-3 py-2 border rounded-lg min-w-[140px]"
                >
                  {CURRENCIES.map(currency => (
                    <option key={currency.value} value={currency.value}>
                      {currency.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Simple textarea for description */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={5}
              className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>

          {/* Duration and Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Duration (days)</label>
              <input
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                className="mt-1 w-full px-3 py-2 border rounded-lg"
                min="1"
                required
              />
            </div>
            <div className="flex items-center">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </div>
          </div>

          {/* Enabled Content Types */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enabled QR Content Types
            </label>
            <div className="grid grid-cols-2 gap-2 p-4 border rounded-lg">
              {QR_CONTENT_TYPES.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.enabledContentTypes.includes(key)}
                    onChange={(e) => {
                      const types = e.target.checked
                        ? [...formData.enabledContentTypes, key]
                        : formData.enabledContentTypes.filter(t => t !== key);
                      setFormData({ ...formData, enabledContentTypes: types });
                    }}
                    className="rounded text-blue-600"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Features */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Plan Features
            </label>
            <div className="space-y-3">
              {formData.features.map((feature, index) => (
                <div key={feature.key} className="flex items-center gap-4">
                  <span className="text-sm text-gray-700 w-40">{feature.label}</span>
                  {feature.type === 'boolean' ? (
                    <input
                      type="checkbox"
                      checked={Boolean(feature.value)}
                      onChange={(e) => {
                        const newFeatures = [...formData.features];
                        newFeatures[index] = { ...feature, value: e.target.checked };
                        setFormData({ ...formData, features: newFeatures });
                      }}
                      className="rounded text-blue-600"
                    />
                  ) : (
                    <input
                      type="number"
                      value={Number(feature.value)}
                      onChange={(e) => {
                        const newFeatures = [...formData.features];
                        newFeatures[index] = { ...feature, value: Number(e.target.value) };
                        setFormData({ ...formData, features: newFeatures });
                      }}
                      className="w-24 px-3 py-1 border rounded-lg"
                      min="0"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : plan ? 'Update Plan' : 'Create Plan'}
          </button>
        </form>
      </div>
    </div>
  );
}
