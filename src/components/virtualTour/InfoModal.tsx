import { Hotspot } from '@/types/virtualTour';

interface Props {
  hotspot: Hotspot;
  onClose: () => void;
}

export default function InfoModal({ hotspot, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{hotspot.title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="prose">
          <p className="text-gray-600">{hotspot.description}</p>
        </div>

        {hotspot.iconUrl && (
          <div className="mt-4">
            <img
              src={hotspot.iconUrl}
              alt={hotspot.title}
              className="w-full max-h-[200px] object-contain"
            />
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
