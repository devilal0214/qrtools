import { useState, useEffect, useRef } from 'react';
import { VirtualTourProject, Scene } from '@/types/virtualTour';
import { createSphereGeometry } from '@/utils/threeHelpers';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

interface Props {
  project: VirtualTourProject;
  onSceneChange?: (sceneId: string) => void;
  initialSceneId?: string;
}

export default function TourViewer({ project, onSceneChange, initialSceneId }: Props) {
  const [currentScene, setCurrentScene] = useState<Scene | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    // Initialize scene
    if (!containerRef.current) return;

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

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    controlsRef.current = controls;

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  // Handle scene changes
  useEffect(() => {
    const loadScene = async (sceneId: string) => {
      setLoading(true);
      const scene = project.scenes.find(s => s.id === sceneId);
      if (scene && sceneRef.current) {
        try {
          // Clear existing scene
          while (sceneRef.current.children.length > 0) {
            sceneRef.current.remove(sceneRef.current.children[0]);
          }

          // Load panorama texture
          const texture = await new THREE.TextureLoader().loadAsync(scene.imageUrl);
          const geometry = createSphereGeometry();
          const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide });
          const sphere = new THREE.Mesh(geometry, material);
          
          sceneRef.current.add(sphere);
          setCurrentScene(scene);
          onSceneChange?.(sceneId);
        } catch (error) {
          console.error('Error loading scene:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    if (initialSceneId) {
      loadScene(initialSceneId);
    } else if (project.scenes.length > 0) {
      loadScene(project.scenes[0].id);
    }
  }, [initialSceneId, project.scenes, onSceneChange]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;

      const container = containerRef.current;
      const camera = cameraRef.current;
      const renderer = rendererRef.current;

      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Load stored scenes from localStorage
    const loadStoredScenes = () => {
      const storedScenes = JSON.parse(localStorage.getItem('virtualTourScenes') || '[]');
      return storedScenes.filter(scene => scene.imageUrl);
    };

    // Initialize viewer with local storage data
    const scenes = loadStoredScenes();
    // ... rest of initialization code
  }, [project]);

  return (
    <div className="relative w-full h-full min-h-[500px]">
      <div ref={containerRef} className="absolute inset-0">
        {loading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>
      
      {/* Scene Navigation */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {project.scenes.map(scene => (
          <button
            key={scene.id}
            onClick={() => setCurrentScene(scene)}
            className={`px-3 py-1 rounded-lg text-sm transition-colors ${
              currentScene?.id === scene.id
                ? 'bg-white text-black'
                : 'bg-black/50 text-white hover:bg-black/75'
            }`}
          >
            {scene.title}
          </button>
        ))}
      </div>
    </div>
  );
}
