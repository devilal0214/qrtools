import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Scene, Hotspot } from '@/types/virtualTour';
import HotspotModal from './HotspotModal';

interface Props {
  scene: Scene;
  availableScenes?: Scene[];
  onSceneUpdate?: (scene: Scene) => void;
  onHotspotClick?: (hotspot: Hotspot) => void;
  isEditing?: boolean;
}

export default function SceneViewer({ scene, availableScenes = [], onSceneUpdate, onHotspotClick, isEditing = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sphereRef = useRef<THREE.Mesh | null>(null);
  const hotspotsRef = useRef<THREE.Object3D[]>([]);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  
  const [showHotspotModal, setShowHotspotModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<THREE.Vector3 | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current || !scene.imageUrl) return;

    const container = containerRef.current;
    setIsLoading(true);

    // Initialize Three.js scene
    const threeScene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    
    sceneRef.current = threeScene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Load panorama texture
    new THREE.TextureLoader().load(
      scene.imageUrl,
      (texture) => {
        // Create sphere with loaded texture
        const geometry = new THREE.SphereGeometry(500, 60, 40);
        geometry.scale(-1, 1, 1);
        
        const material = new THREE.MeshBasicMaterial({ 
          map: texture,
          side: THREE.DoubleSide 
        });
        
        const sphere = new THREE.Mesh(geometry, material);
        sphereRef.current = sphere;
        threeScene.add(sphere);
        
        // Add hotspots after scene is loaded
        addHotspotsToScene();
        
        setIsLoading(false);
      },
      undefined,
      (error) => {
        console.error('Error loading panorama:', error);
        setIsLoading(false);
      }
    );

    // Setup controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.rotateSpeed = -0.5;
    camera.position.z = 0.1;

    // Add click handler for adding hotspots
    const handleSceneClick = (event: MouseEvent) => {
      if (!isEditing || !sphereRef.current || !cameraRef.current) return;

      const rect = containerRef.current!.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      mouseRef.current.set(x, y);
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

      const intersects = raycasterRef.current.intersectObject(sphereRef.current);

      if (intersects.length > 0) {
        const point = intersects[0].point.clone().normalize().multiplyScalar(490);
        const spherical = new THREE.Spherical().setFromVector3(point);

        const position = new THREE.Vector3(
          THREE.MathUtils.radToDeg(spherical.theta),
          90 - THREE.MathUtils.radToDeg(spherical.phi),
          0
        );

        setSelectedPosition(position);
        setShowHotspotModal(true);
      }
    };

    // Add click event listener
    if (isEditing) {
      renderer.domElement.addEventListener('click', handleSceneClick);
    }

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(threeScene, camera);
    };
    animate();

    // Cleanup
    return () => {
      if (isEditing) {
        renderer.domElement.removeEventListener('click', handleSceneClick);
      }
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [scene.imageUrl, isEditing]);

  // Function to add hotspots to scene
  const addHotspotsToScene = () => {
    if (!sceneRef.current || !scene.hotspots) return;

    // Clear existing hotspots
    hotspotsRef.current.forEach(hotspot => {
      sceneRef.current?.remove(hotspot);
    });
    hotspotsRef.current = [];

    // Add new hotspots
    scene.hotspots.forEach(hotspot => {
      const hotspotMesh = createHotspotMesh(hotspot);
      if (hotspotMesh) {
        sceneRef.current?.add(hotspotMesh);
        hotspotsRef.current.push(hotspotMesh);
      }
    });
  };

  // Create hotspot mesh
  const createHotspotMesh = (hotspot: Hotspot) => {
    const group = new THREE.Group();
    
    // Create visual representation
    const geometry = new THREE.SphereGeometry(5, 32, 32);
    const material = new THREE.MeshBasicMaterial({
      color: hotspot.type === 'info' ? 0x00ff00 : 0x0000ff,
      opacity: 0.8,
      transparent: true
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // Position the hotspot
    const phi = THREE.MathUtils.degToRad(90 - hotspot.position.y);
    const theta = THREE.MathUtils.degToRad(hotspot.position.x);
    
    const radius = 490; // Slightly less than sphere radius
    mesh.position.set(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
    
    group.add(mesh);
    group.userData.hotspot = hotspot;
    
    return group;
  };

  // Handle hotspot addition
  const handleHotspotSave = async (hotspotData: Partial<Hotspot>) => {
    try {
      if (!onSceneUpdate) {
        throw new Error('Scene update handler not provided to SceneViewer');
      }

      if (!selectedPosition) {
        throw new Error('No position selected for hotspot');
      }

      const newHotspot: Hotspot = {
        id: Math.random().toString(36).substr(2, 9),
        title: hotspotData.title || '',
        type: hotspotData.type || 'info',
        description: hotspotData.type === 'info' ? hotspotData.description || null : null,
        targetSceneId: hotspotData.type === 'navigation' ? hotspotData.targetSceneId || null : null,
        iconUrl: hotspotData.iconUrl || null,
        iconSize: hotspotData.iconSize,
        position: {
          x: selectedPosition.x,
          y: selectedPosition.y,
          z: selectedPosition.z || 0
        }
      };

      console.log('Saving hotspot:', newHotspot);

      // Create new array if hotspots doesn't exist
      const updatedScene = {
        ...scene,
        hotspots: [...(scene.hotspots || []), newHotspot]
      };

      await onSceneUpdate(updatedScene);
      setShowHotspotModal(false);
      setSelectedPosition(null);
      
      // Refresh hotspots
      addHotspotsToScene();
    } catch (error) {
      console.error('Error saving hotspot:', error);
      // Could add error notification here
    }
  };

  const handleHotspotUpdate = (hotspot: Hotspot) => {
    if (!onSceneUpdate) return;

    const updatedScene = {
      ...scene,
      hotspots: scene.hotspots?.map(h => 
        h.id === hotspot.id ? hotspot : h
      ) || []
    };

    onSceneUpdate(updatedScene);
  };

  const handleHotspotDelete = (hotspotId: string) => {
    if (!onSceneUpdate) return;

    const updatedScene = {
      ...scene,
      hotspots: scene.hotspots?.filter(h => h.id !== hotspotId) || []
    };

    onSceneUpdate(updatedScene);
  };

  return (
    <div className="relative w-full h-[600px]">
      <div ref={containerRef} className="w-full h-full" />
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      )}
      
      {showHotspotModal && (
        <HotspotModal
          isOpen={showHotspotModal}
          onClose={() => setShowHotspotModal(false)}
          onSave={handleHotspotSave}
          position={selectedPosition}
          availableScenes={availableScenes}
        />
      )}

      {isEditing && (
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
          <p className="text-sm text-gray-600">Click anywhere on the scene to add a hotspot</p>
        </div>
      )}
    </div>
  );
}
