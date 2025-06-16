import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Scene, Hotspot } from '@/types/virtualTour';
import HotspotModal from './HotspotModal';
import InfoModal from './InfoModal';
import { createHotspotGeometry } from '@/utils/threeHelpers';

interface Props {
  scene: Scene;
  onSceneUpdate?: (scene: Scene) => void;
  onUpdate?: (scene: Scene) => Promise<void>;
  onHotspotClick?: (hotspot: Hotspot) => void;
  onNavigate?: (sceneId: string) => void;
  saving?: boolean;
  isEditing?: boolean;
  availableScenes?: Scene[];
}

export default function SceneViewer({ 
  scene, 
  onSceneUpdate, 
  onHotspotClick,
  onNavigate,
  saving = false, 
  isEditing = false,
  availableScenes = []
}: Props) {
  const [showHotspotModal, setShowHotspotModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<THREE.Vector3 | null>(null);
  const [selectedInfoHotspot, setSelectedInfoHotspot] = useState<Hotspot | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef(new THREE.Scene());
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sphereRef = useRef<THREE.Mesh | null>(null);
  const hotspotsRef = useRef<THREE.Mesh[]>([]);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationFrameRef = useRef<number>();
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  // Function to create a hotspot mesh
  const createHotspotMesh = (hotspot: Hotspot) => {
    const geometry = createHotspotGeometry();
    const material = new THREE.MeshBasicMaterial({ 
      color: hotspot.type === 'info' ? 0x00ff00 : 0x0000ff,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(hotspot.position.x, hotspot.position.y, hotspot.position.z);
    mesh.userData.hotspot = hotspot;

    // Make sure hotspot always faces the camera
    mesh.onBeforeRender = () => {
      if (cameraRef.current) {
        mesh.lookAt(cameraRef.current.position);
      }
    };

    return mesh;
  };

  // Update hotspot meshes
  useEffect(() => {
    if (!sceneRef.current) return;

    // Remove existing hotspot meshes
    hotspotsRef.current.forEach(mesh => {
      sceneRef.current.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    hotspotsRef.current = [];    // Create new hotspot meshes
    if (scene.hotspots) {
      console.log('Creating hotspot meshes for scene:', scene.id);
      scene.hotspots.forEach(hotspot => {
        console.log('Creating mesh for hotspot:', hotspot);
        const mesh = createHotspotMesh(hotspot);
        sceneRef.current.add(mesh);
        hotspotsRef.current.push(mesh);
      });
      console.log('Created', hotspotsRef.current.length, 'hotspot meshes');
    }
  }, [scene.hotspots]);

  // Initialize scene
  useEffect(() => {
    if (!containerRef.current || !scene.imageUrl) {
      console.warn('Container or scene image URL not available');
      return;
    }

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Setup camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 0.1;
    cameraRef.current = camera;

    // Setup controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.rotateSpeed = -0.5;
    controlsRef.current = controls;

    // Load panorama
    const textureLoader = new THREE.TextureLoader();
    console.log('Loading panorama:', scene.imageUrl);
    
    textureLoader.load(
      scene.imageUrl,
      (texture) => {
        texture.minFilter = THREE.LinearFilter;
        const geometry = new THREE.SphereGeometry(500, 60, 40);
        geometry.scale(-1, 1, 1);
        
        const material = new THREE.MeshBasicMaterial({ map: texture });
        const sphere = new THREE.Mesh(geometry, material);
        
        // Clear existing sphere if any
        if (sphereRef.current) {
          sceneRef.current.remove(sphereRef.current);
          sphereRef.current.geometry.dispose();
          (sphereRef.current.material as THREE.Material).dispose();
        }
          sphereRef.current = sphere;
        sceneRef.current.add(sphere);
        console.log('Panorama loaded successfully');

        // Recreate hotspot meshes when panorama loads
        hotspotsRef.current.forEach(mesh => {
          sceneRef.current.remove(mesh);
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
        });
        hotspotsRef.current = [];

        if (scene.hotspots) {
          scene.hotspots.forEach(hotspot => {
            const mesh = createHotspotMesh(hotspot);
            sceneRef.current.add(mesh);
            hotspotsRef.current.push(mesh);
          });
        }
      },
      undefined,
      (error) => console.error('Error loading panorama:', error)
    );

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(sceneRef.current, camera);
    };
    animate();

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      console.log('Cleaning up scene');
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      controls.dispose();
      renderer.dispose();
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [scene.imageUrl]);

  // Handle click events differently for edit and view modes
  const handleClick = (event: React.MouseEvent) => {
    if (!containerRef.current || !cameraRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

    if (isEditing) {
      // In edit mode, intersect with the panorama sphere for hotspot creation
      const intersects = raycasterRef.current.intersectObject(sphereRef.current!);
      if (intersects.length > 0) {
        setSelectedPosition(intersects[0].point);
        setShowHotspotModal(true);
      }
    } else {      // In view mode, intersect with hotspots for interaction
      console.log('Checking intersections with', hotspotsRef.current.length, 'hotspots');
      const intersects = raycasterRef.current.intersectObjects(hotspotsRef.current);
      console.log('Found', intersects.length, 'intersections');
      if (intersects.length > 0) {
        const hotspot = intersects[0].object.userData.hotspot as Hotspot;
        console.log('Clicked hotspot:', hotspot);
        if (hotspot.type === 'info') {
          setSelectedInfoHotspot(hotspot);
        } else if (hotspot.type === 'navigation' && onHotspotClick) {
          console.log('Calling onHotspotClick with:', hotspot);
          onHotspotClick(hotspot);
        }
      }
    }
  };

  return (
    <div className="relative">
      <div 
        ref={containerRef} 
        className="w-full h-full bg-black rounded-lg overflow-hidden"
        style={{ minHeight: '600px' }}
        onClick={handleClick}
      />
      
      {isEditing && showHotspotModal && selectedPosition && (
        <HotspotModal
          isOpen={showHotspotModal}
          onClose={() => setShowHotspotModal(false)}
          onSave={async (hotspotData) => {
            if (!onSceneUpdate || !selectedPosition) return;
            
            const newHotspot: Hotspot = {
              id: Math.random().toString(36).substr(2, 9),
              type: hotspotData.type || 'info',
              title: hotspotData.title || 'Untitled Hotspot',
              description: hotspotData.description || null,
              targetSceneId: hotspotData.targetSceneId || null,
              iconUrl: hotspotData.iconUrl || null,
              iconSize: hotspotData.iconSize || null,
              position: {
                x: selectedPosition.x,
                y: selectedPosition.y,
                z: selectedPosition.z
              }
            };

            console.log('Adding new hotspot:', newHotspot);
            const updatedScene = {
              ...scene,
              hotspots: [...(scene.hotspots || []), newHotspot]
            };

            try {
              await onSceneUpdate(updatedScene);
              setShowHotspotModal(false);
              setSelectedPosition(null);
            } catch (error) {
              console.error('Error updating scene:', error);
            }
          }}
          availableScenes={availableScenes}
          position={selectedPosition}
        />
      )}

      {selectedInfoHotspot && (
        <InfoModal
          hotspot={selectedInfoHotspot}
          onClose={() => setSelectedInfoHotspot(null)}
        />
      )}
    </div>
  );
}
