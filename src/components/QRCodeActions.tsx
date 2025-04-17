import { useRouter } from 'next/router';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import type { QRCode } from '@/types/qr';  // Update import to use type import
import toast from 'react-hot-toast';

interface QRCodeActionsProps {
  qrCode: QRCode;
  onEdit: (qrCode: QRCode) => void;
  onDelete: (id: string) => void;
  onPauseResume?: (id: string) => void;
}

const QRCodeActions = ({ qrCode, onEdit, onDelete, onPauseResume }: QRCodeActionsProps) => {
  const { canUseFeature } = usePlanFeatures();
  const router = useRouter();

  const handleEdit = (qrCode: QRCode) => {
    onEdit(qrCode);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this QR code?')) {
      onDelete(id);
    }
  };

  const handlePauseResume = async (id: string) => {
    if (onPauseResume) {
      onPauseResume(id);
    }
  };

  return (
    <div className="flex items-center gap-4">
      {canUseFeature('pauseResume') && onPauseResume && (
        <button
          onClick={() => handlePauseResume(qrCode.id)}
          className="text-yellow-600 hover:text-yellow-700"
        >
          {qrCode.isActive ? 'Pause' : 'Resume'}
        </button>
      )}

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
};

export default QRCodeActions;
