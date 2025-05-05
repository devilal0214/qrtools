import { VirtualTourProject } from '@/types/virtualTour';
import { useRouter } from 'next/router';
import Image from 'next/image';

interface Props {
  tour: VirtualTourProject;
}

export default function TourCard({ tour }: Props) {
  const router = useRouter();

  const handleViewTour = () => {
    router.push(`/virtual-tour/view/${tour.id}`);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-all duration-200">
      <div className="aspect-video relative">
        <Image
          src={tour.thumbnail || '/placeholder-tour.jpg'}
          alt={tour.title}
          layout="fill"
          objectFit="cover"
          className="transition-transform hover:scale-105"
        />
      </div>
      
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-1 truncate">
          {tour.title}
        </h3>
        
        <p className="text-sm text-gray-500 line-clamp-2 mb-4 h-10">
          {tour.description}
        </p>
        
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {new Date(tour.createdAt).toLocaleDateString()}
          </span>
          
          <button
            onClick={handleViewTour}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            View Tour
          </button>
        </div>
      </div>
    </div>
  );
}
