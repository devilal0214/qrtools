import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Banner } from '@/types/banner';

export default function PageBanner() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const q = query(
          collection(db, 'banners'),
          where('pages', 'array-contains', router.pathname),
          where('isActive', '==', true)
        );
        const querySnapshot = await getDocs(q);
        const fetchedBanners = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Banner))
          .sort((a, b) => a.displayOrder - b.displayOrder);
        setBanners(fetchedBanners);
      } catch (error) {
        console.error('Error fetching banners:', error);
      }
    };

    fetchBanners();
  }, [router.pathname]);

  if (!banners.length) return null;

  return (
    <div className="w-full">
      {banners.map((banner) => (
        <div 
          key={banner.id}
          className="relative"
          style={{ height: banner.height }}
        >
          {banner.link ? (
            <a href={banner.link} target="_blank" rel="noopener noreferrer">
              <img
                src={banner.imageUrl}
                alt={banner.title || 'Banner'}
                className="w-full object-cover"
                style={{ height: banner.height }}
              />
            </a>
          ) : (
            <img
              src={banner.imageUrl}
              alt={banner.title || 'Banner'}
              className="w-full object-cover"
              style={{ height: banner.height }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
