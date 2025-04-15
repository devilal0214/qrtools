import { usePlanFeatures } from '@/hooks/usePlanFeatures';
// ...existing imports...

export default function QRCodeActions({ qrCode }) {
  const { canUseFeature, canCreateMoreQR } = usePlanFeatures();

  const handleCreate = () => {
    if (!canCreateMoreQR()) {
      toast.error("You've reached your daily QR code limit. Please upgrade your plan.");
      router.push('/dashboard/plans');
      return;
    }
    // ... rest of create logic
  };

  // ...existing state...

  return (
    <div className="flex gap-2">
      {canUseFeature('analytics') && (
        <button
          onClick={() => handleAnalytics(qrCode.id)}
          className="text-blue-600 hover:text-blue-700"
        >
          Analytics
        </button>
      )}

      {canUseFeature('pauseResume') && (
        <button
          onClick={() => handlePauseResume(qrCode.id)}
          className="text-yellow-600 hover:text-yellow-700"
        >
          {qrCode.isActive ? 'Pause' : 'Resume'}
        </button>
      )}

      {/* Other actions that are always available */}
      <button
        onClick={() => handleEdit(qrCode)}
        className="text-gray-600 hover:text-gray-700"
      >
        Edit
      </button>
      
      <button
        onClick={() => handleDelete(qrCode.id)}
        className="text-red-600 hover:text-red-700"
      >
        Delete
      </button>
    </div>
  );
}
