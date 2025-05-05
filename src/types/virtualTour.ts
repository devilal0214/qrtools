export interface HotspotPosition {
  x: number;
  y: number;
  z: number;
}

export interface Hotspot {
  id: string;
  type: 'info' | 'navigation';
  title: string;
  description?: string | null;
  targetSceneId?: string | null;
  iconUrl?: string | null;
  iconSize?: {
    width: number;
    height: number;
  };
  position: HotspotPosition;
}

export interface Scene {
  id: string;
  title: string;
  imageUrl: string;
  hotspots?: Hotspot[];
}

export interface VirtualTour {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  scenes: Scene[];
  startingSceneId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}
