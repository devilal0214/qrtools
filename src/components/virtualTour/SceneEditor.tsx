import { useState, useRef, useEffect } from 'react';
import { Scene, Hotspot } from '@/types/virtualTour';
import { uploadFile } from '@/utils/fileUpload';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import type { MouseEvent as ReactMouseEvent } from 'react';
import SceneViewer from './SceneViewer';
import HotspotModal from './HotspotModal';

interface Props {
  scene: Scene;
  scenes: Scene[];
  onUpdate: (scene: Scene) => void;
}

export default function SceneEditor({ scene, scenes, onUpdate }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState(scene.title);
  const [editingHotspot, setEditingHotspot] = useState<Hotspot | null>(null);
  const [showHotspotModal, setShowHotspotModal] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize Three.js scene
    const container = containerRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });

    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.rotateSpeed = -0.5;

    rendererRef.current = renderer;
    cameraRef.current = camera;
    controlsRef.current = controls;

    return () => {
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  const handleImageUpload = async (file: File) => {
    try {
      setIsLoading(true);
      const imageUrl = await uploadFile(file, {
        folder: 'virtual-tours',
        allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
        maxSize: 10 * 1024 * 1024 // 10MB
      });

      onUpdate({
        ...scene,
        imageUrl
      });
    } catch (error) {
      console.error('Error uploading scene image:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHotspotAdd = (hotspot: Hotspot) => {
    const updatedScene = {
      ...scene,
      hotspots: [...(scene.hotspots || []), hotspot]
    };
    onUpdate(updatedScene);
  };

  const handleTitleUpdate = () => {
    if (title !== scene.title) {
      onUpdate({ ...scene, title });
    }
  };

  const handleHotspotClick = (hotspot: Hotspot) => {
    // Handle hotspot click in edit mode - you could open an edit modal here
    console.log('Edit hotspot:', hotspot);
  };

  const handleHotspotEdit = (hotspot: Hotspot) => {
    setEditingHotspot(hotspot);
    setShowHotspotModal(true);
  };

  const handleHotspotSave = (data: Partial<Hotspot>) => {
    try {
      const updatedScene = { ...scene };
      if (editingHotspot) {
        // Update existing hotspot
        updatedScene.hotspots = scene.hotspots?.map(h => 
          h.id === editingHotspot.id 
            ? {
                ...h,
                title: data.title || h.title,
                type: data.type || h.type,
                description: data.description || h.description || null,
                targetSceneId: data.targetSceneId || h.targetSceneId || null,
                iconUrl: data.iconUrl || h.iconUrl || null,
                position: h.position // Keep existing position
              }
            : h
        ) || [];
      } else {
        // Create new hotspot
        const newHotspot: Hotspot = {
          id: Math.random().toString(36).substr(2, 9),
          title: data.title || 'Untitled Hotspot',
          type: data.type || 'info',
          position: data.position || { x: 0, y: 0, z: 0 },
          description: data.description || null,
          targetSceneId: data.targetSceneId || null,
          iconUrl: data.iconUrl || null
        };
        updatedScene.hotspots = [...(scene.hotspots || []), newHotspot];
      }

      // Ensure hotspots array exists
      if (!updatedScene.hotspots) {
        updatedScene.hotspots = [];
      }

      // Clean up any undefined values before updating
      updatedScene.hotspots = updatedScene.hotspots.map(hotspot => ({
        ...hotspot,
        description: hotspot.description || null,
        targetSceneId: hotspot.targetSceneId || null,
        iconUrl: hotspot.iconUrl || null
      }));

      onUpdate(updatedScene);
      setShowHotspotModal(false);
      setEditingHotspot(null);
    } catch (error) {
      console.error('Error saving hotspot:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Scene Title Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleUpdate}
          className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          placeholder="Scene Title"
        />
      </div>

      {/* Scene Viewer with Hotspot Management */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <SceneViewer
          scene={scene}
          availableScenes={scenes.filter(s => s.id !== scene.id)}
          onSceneUpdate={onUpdate}
          onHotspotClick={handleHotspotClick}
          isEditing={true}
        />
      </div>

      {/* Hotspots List */}
      <div className="bg-white rounded-xl p-4 space-y-4">
        <h3 className="font-medium text-gray-900">Hotspots</h3>
        {scene.hotspots && scene.hotspots.length > 0 ? (
          <div className="space-y-2">
            {scene.hotspots.map((hotspot) => (
              <div
                key={hotspot.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">{hotspot.title}</p>
                  <p className="text-sm text-gray-500">
                    {hotspot.type === 'info' ? 'Information' : 'Navigation'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleHotspotEdit(hotspot)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      const updatedScene = {
                        ...scene,
                        hotspots: scene.hotspots?.filter(h => h.id !== hotspot.id)
                      };
                      onUpdate(updatedScene);
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">
            Click anywhere on the scene to add a hotspot
          </p>
        )}
      </div>

      {showHotspotModal && (
        <HotspotModal
          isOpen={showHotspotModal}
          onClose={() => {
            setShowHotspotModal(false);
            setEditingHotspot(null);
          }}
          onSave={handleHotspotSave}
          availableScenes={scenes.filter(s => s.id !== scene.id)}
          currentHotspot={editingHotspot} // Changed from editingHotspot to currentHotspot
        />
      )}
    </div>
  );
}
