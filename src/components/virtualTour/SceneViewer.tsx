import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Scene, Hotspot } from '@/types/virtualTour';
import HotspotModal from './HotspotModal';
import InfoModal from './InfoModal';

interface Props {
  scene: Scene;
  onSceneUpdate?: (scene: Scene) => void;
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
  const [arrowDirection, setArrowDirection] = useState<{ angle: number, visible: boolean, fade?: number } | null>(null);
  const [nearestHotspot, setNearestHotspot] = useState<Hotspot | null>(null);
  
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
  const [hoveredHotspot, setHoveredHotspot] = useState<THREE.Mesh | null>(null);

  // Create a hotspot mesh
  const createHotspotMesh = (hotspot: Hotspot) => {
    const geometry = new THREE.SphereGeometry(12, 24, 24);
    const material = new THREE.MeshBasicMaterial({ 
      color: hotspot.type === 'info' ? 0x00ff00 : 0x0000ff,
      transparent: true,
      opacity: 0.8,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(hotspot.position.x, hotspot.position.y, hotspot.position.z);
    mesh.userData.hotspot = hotspot;
    mesh.userData.isHotspot = true; // Flag for easy identification

    // Always face the camera
    mesh.onBeforeRender = () => {
      if (cameraRef.current) {
        mesh.lookAt(cameraRef.current.position);
      }
    };

    return mesh;
  };

  // Update hotspots when scene changes
  useEffect(() => {
    if (!sceneRef.current) return;

    // Remove existing hotspots
    hotspotsRef.current.forEach(mesh => {
      sceneRef.current.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    hotspotsRef.current = [];

    // Create new hotspots
    if (scene.hotspots) {
      scene.hotspots.forEach(hotspot => {
        const mesh = createHotspotMesh(hotspot);
        sceneRef.current.add(mesh);
        hotspotsRef.current.push(mesh);
      });
    }
  }, [scene.hotspots]);

  // Initialize scene
  useEffect(() => {
    if (!containerRef.current || !scene.imageUrl) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 0.1;
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false; // Disable zooming with mouse wheel
    controls.enablePan = false;
    controls.rotateSpeed = -0.5;
    controlsRef.current = controls;

    // Custom: Mouse wheel rotates panorama horizontally
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      // Calculate current spherical coordinates
      const camera = controls.object;
      const target = controls.target;
      const offset = new THREE.Vector3().subVectors(camera.position, target);
      const spherical = new THREE.Spherical();
      spherical.setFromVector3(offset);
      // Adjust azimuthal angle (horizontal rotation)
      spherical.theta -= event.deltaY * 0.0025; // Adjust sensitivity as needed
      // Update camera position
      offset.setFromSpherical(spherical);
      camera.position.copy(target).add(offset);
      camera.lookAt(target);
      controls.update();
    };
    renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      scene.imageUrl,
      (texture) => {
        texture.minFilter = THREE.LinearFilter;
        const geometry = new THREE.SphereGeometry(500, 60, 40);
        geometry.scale(-1, 1, 1);
        
        const material = new THREE.MeshBasicMaterial({ map: texture });
        const sphere = new THREE.Mesh(geometry, material);
        
        if (sphereRef.current) {
          sceneRef.current.remove(sphereRef.current);
          sphereRef.current.geometry.dispose();
          (sphereRef.current.material as THREE.Material).dispose();
        }

        sphereRef.current = sphere;
        sceneRef.current.add(sphere);
      },
      undefined,
      (error) => console.error('Error loading panorama:', error)
    );

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(sceneRef.current, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      controls.dispose();
      renderer.dispose();
      renderer.domElement.removeEventListener('wheel', handleWheel);
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [scene.imageUrl]);

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!containerRef.current || !cameraRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(hotspotsRef.current);

    if (intersects.length > 0) {
      const intersectedMesh = intersects[0].object;      if (intersectedMesh.userData.isHotspot && intersectedMesh instanceof THREE.Mesh) {
        setHoveredHotspot(intersectedMesh);
        containerRef.current.style.cursor = 'pointer';
      }
    } else {
      setHoveredHotspot(null);
      if (containerRef.current) {
        containerRef.current.style.cursor = 'grab';
      }
    }
  };

  const handleClick = (event: React.MouseEvent) => {
    if (!containerRef.current || !cameraRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

    if (isEditing && sphereRef.current) {
      const intersects = raycasterRef.current.intersectObject(sphereRef.current);
      if (intersects.length > 0) {
        setSelectedPosition(intersects[0].point);
        setShowHotspotModal(true);
      }
    } else {
      const intersects = raycasterRef.current.intersectObjects(hotspotsRef.current);
      if (intersects.length > 0 && intersects[0].object.userData.isHotspot) {
        const hotspot = intersects[0].object.userData.hotspot as Hotspot;
        if (onHotspotClick) {
          event.preventDefault();
          event.stopPropagation();
          console.log('Triggering hotspot click:', hotspot);
          onHotspotClick(hotspot);
        }
      }
    }
  };

  function toScreenPosition(objPos: THREE.Vector3, camera: THREE.PerspectiveCamera, container: HTMLDivElement) {
    const vector = objPos.clone().project(camera);
    const x = (vector.x + 1) / 2 * container.clientWidth;
    const y = (-vector.y + 1) / 2 * container.clientHeight;
    return { x, y, z: vector.z };
  }

  // Update updateArrow() in useEffect to only consider navigation hotspots:
  useEffect(() => {
    function updateArrow() {
      if (!cameraRef.current || !containerRef.current || !scene.hotspots?.length) {
        setArrowDirection(null);
        setNearestHotspot(null);
        return;
      }
      const camera = cameraRef.current;
      const container = containerRef.current;
      let minAngle = Infinity;
      let bestHotspot: Hotspot | null = null;
      let bestAngle = 0;
      const cameraDir = new THREE.Vector3();
      camera.getWorldDirection(cameraDir);
      // Only consider navigation hotspots
      const navHotspots = scene.hotspots.filter(h => h.type === 'navigation');
      navHotspots.forEach(hotspot => {
        const hotspotPos = new THREE.Vector3(hotspot.position.x, hotspot.position.y, hotspot.position.z);
        // Direction from camera to hotspot
        const toHotspot = hotspotPos.clone().sub(camera.position).normalize();
        // Angle between camera direction and hotspot
        const angle = cameraDir.angleTo(toHotspot);
        if (angle < minAngle) {
          minAngle = angle;
          bestHotspot = hotspot;
          // Calculate signed angle for 2D arrow
          const cross = new THREE.Vector3().crossVectors(cameraDir, toHotspot);
          bestAngle = cross.y < 0 ? -angle : angle;
        }
      });
      // Project bestHotspot to screen
      if (bestHotspot) {
        const hotspotPos = new THREE.Vector3(bestHotspot.position.x, bestHotspot.position.y, bestHotspot.position.z);
        const screen = toScreenPosition(hotspotPos, camera, container);
        // Check if hotspot is near center (in view)
        const centerX = container.clientWidth / 2;
        const centerY = container.clientHeight / 2;
        const dx = screen.x - centerX;
        const dy = screen.y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // If hotspot is far from center or behind camera, show arrow
        let fade = 1;
        if (dist < 120 && screen.z <= 1) {
          fade = Math.max(0, Math.min(1, (dist - 40) / 80)); // Fade out as it gets close
        }
        if (dist > 120 || screen.z > 1) {
          setArrowDirection({ angle: Math.atan2(dy, dx), visible: true, fade });
          setNearestHotspot(bestHotspot);
        } else if (fade > 0) {
          setArrowDirection({ angle: Math.atan2(dy, dx), visible: true, fade });
          setNearestHotspot(bestHotspot);
        } else {
          setArrowDirection({ angle: 0, visible: false, fade: 0 });
          setNearestHotspot(null);
        }
      } else {
        setArrowDirection(null);
        setNearestHotspot(null);
      }
    }
    // Animation frame
    let frameId: number;
    function animateArrow() {
      updateArrow();
      frameId = requestAnimationFrame(animateArrow);
    }
    animateArrow();
    return () => cancelAnimationFrame(frameId);
  }, [scene.hotspots]);

  // Helper to get screen position of a 3D point
  function getScreenPosition(vec3: THREE.Vector3, camera: THREE.PerspectiveCamera, container: HTMLDivElement) {
    const vector = vec3.clone().project(camera);
    const x = (vector.x + 1) / 2 * container.clientWidth;
    const y = (-vector.y + 1) / 2 * container.clientHeight;
    return { x, y };
  }

  // Add click handler for the arrow:
  const handleArrowClick = () => {
    if (nearestHotspot && onHotspotClick) {
      onHotspotClick(nearestHotspot);
    }
  };

  return (
    <div className="relative">
      <div 
        ref={containerRef} 
        className="w-full h-full bg-black rounded-lg overflow-hidden"
        style={{ minHeight: '600px' }}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
      />
      {/* Dotted line from arrow to nearest navigation hotspot */}
      {arrowDirection && arrowDirection.visible && nearestHotspot && containerRef.current && cameraRef.current && (() => {
        // Arrow base (center of screen, offset by arrow distance)
        const container = containerRef.current;
        const camera = cameraRef.current;
        const centerX = container.clientWidth / 2;
        const centerY = container.clientHeight / 2;
        const arrowLength = 260; // px, matches translateX(260px)
        // Hotspot screen position
        const hotspotPos = new THREE.Vector3(nearestHotspot.position.x, nearestHotspot.position.y, nearestHotspot.position.z);
        const hotspotScreen = getScreenPosition(hotspotPos, camera, container);
        // Arrow tip position (where the arrow is rendered)
        const arrowX = centerX + Math.cos(arrowDirection.angle) * arrowLength;
        const arrowY = centerY + Math.sin(arrowDirection.angle) * arrowLength;
        // Calculate the angle from the arrow's position to the hotspot
        const dx = hotspotScreen.x - arrowX;
        const dy = hotspotScreen.y - arrowY;
        const arrowToHotspotAngle = Math.atan2(dy, dx);
        // Only draw if hotspot is off center
        if (Math.abs(hotspotScreen.x - centerX) > 10 || Math.abs(hotspotScreen.y - centerY) > 10) {
          return (
            <>
              <svg
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: container.clientWidth,
                  height: container.clientHeight,
                  pointerEvents: 'none',
                  zIndex: 9,
                }}
                width={container.clientWidth}
                height={container.clientHeight}
              >
                <line
                  x1={arrowX}
                  y1={arrowY}
                  x2={hotspotScreen.x}
                  y2={hotspotScreen.y}
                  stroke="#2563eb"
                  strokeWidth="3"
                  strokeDasharray="8 8"
                  opacity="0.7"
                />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  left: arrowX,
                  top: arrowY,
                  transform: `translate(-50%, -50%) rotate(${arrowToHotspotAngle}rad)`,
                  zIndex: 10,
                  pointerEvents: 'auto',
                  transition: 'opacity 0.3s',
                  opacity: arrowDirection.visible && arrowDirection.fade ? arrowDirection.fade : 1,
                  cursor: 'pointer',
                }}
                onClick={handleArrowClick}
                title={nearestHotspot.title || 'Go to hotspot'}
              >
                <Arrow3D opacity={arrowDirection.visible && arrowDirection.fade ? arrowDirection.fade : 1} />
              </div>
            </>
          );
        }
        return null;
      })()}

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

            try {
              await onSceneUpdate({
                ...scene,
                hotspots: [...(scene.hotspots || []), newHotspot]
              });
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

// Replace Arrow3D with a minimal, bold chevron with shadow and blue glow:
const Arrow3D = ({ opacity = 1 }: { opacity?: number }) => (
  <svg width="60" height="60" viewBox="0 0 60 60" style={{ opacity, filter: 'drop-shadow(0 4px 16px #2563eb88) drop-shadow(0 0px 2px #000a)' }}>
    <g>
      <path
        d="M30 10 L50 35 Q51 36 50 37 L45 42 Q44 43 43 42 L30 25 L17 42 Q16 43 15 42 L10 37 Q9 36 10 35 L30 10 Z"
        fill="#fff"
        stroke="#2563eb"
        strokeWidth="2.5"
        style={{ filter: 'drop-shadow(0 2px 8px #2563eb66)' }}
      />
      <path
        d="M30 10 L50 35 Q51 36 50 37 L45 42 Q44 43 43 42 L30 25 L17 42 Q16 43 15 42 L10 37 Q9 36 10 35 L30 10 Z"
        fill="none"
        stroke="#000"
        strokeOpacity="0.18"
        strokeWidth="5"
        style={{ filter: 'blur(2px)' }}
      />
    </g>
  </svg>
);
