import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { VirtualTourProject, Scene, Hotspot } from '@/types/virtualTour';
import AuthGuard from '@/components/AuthGuard';
import DashboardLayout from '@/components/DashboardLayout';
import SceneEditor from '@/components/virtualTour/SceneEditor';
import HotspotEditor from '@/components/virtualTour/HotspotEditor';

export default function VirtualTourEditor() {
  const [project, setProject] = useState<VirtualTourProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();

  useEffect(() => {
    if (id && user) {
      loadProject();
    }
  }, [id, user]);

  const loadProject = async () => {
    try {
      const docRef = doc(db, 'virtualTours', id as string);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists() && docSnap.data().userId === user?.uid) {
        setProject(docSnap.data() as VirtualTourProject);
        if (docSnap.data().scenes?.length > 0) {
          setSelectedScene(docSnap.data().scenes[0]);
        }
      } else {
        router.push('/dashboard/virtual-tours');
      }
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSceneUpdate = async (updatedScene: Scene) => {
    if (!project || !user) return;

    try {
      const updatedScenes = project.scenes.map(scene =>
        scene.id === updatedScene.id ? updatedScene : scene
      );

      await updateDoc(doc(db, 'virtualTours', project.id), {
        scenes: updatedScenes,
        updatedAt: new Date().toISOString()
      });

      setProject(prev => ({
        ...prev!,
        scenes: updatedScenes
      }));
      setSelectedScene(updatedScene);
    } catch (error) {
      console.error('Error updating scene:', error);
    }
  };

  const handleHotspotUpdate = async (sceneId: string, updatedHotspot: Hotspot) => {
    if (!project || !selectedScene) return;

    try {
      const updatedScene = {
        ...selectedScene,
        hotspots: selectedScene.hotspots.map(hotspot =>
          hotspot.id === updatedHotspot.id ? updatedHotspot : hotspot
        )
      };

      await handleSceneUpdate(updatedScene);
      setSelectedHotspot(null);
    } catch (error) {
      console.error('Error updating hotspot:', error);
    }
  };

  if (loading) {
    return (
      <AuthGuard>
        <DashboardLayout>
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        </DashboardLayout>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              {project?.title || 'Virtual Tour Editor'}
            </h1>
            <button
              onClick={() => router.push('/dashboard/virtual-tours')}
              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
            >
              Back to Projects
            </button>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Scene List */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="text-lg font-medium mb-4">Scenes</h2>
              <div className="space-y-2">
                {project?.scenes.map(scene => (
                  <button
                    key={scene.id}
                    onClick={() => setSelectedScene(scene)}
                    className={`w-full p-3 rounded-lg text-left transition ${
                      selectedScene?.id === scene.id
                        ? 'bg-blue-50 text-blue-600'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {scene.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Scene Editor */}
            <div className="lg:col-span-2">
              {selectedScene ? (
                <SceneEditor
                  scene={selectedScene}
                  onUpdate={handleSceneUpdate}
                  onSelectHotspot={setSelectedHotspot}
                />
              ) : (
                <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-500">
                  Select a scene to edit
                </div>
              )}
            </div>
          </div>

          {/* Hotspot Editor Modal */}
          {selectedHotspot && selectedScene && (
            <HotspotEditor
              hotspot={selectedHotspot}
              sceneId={selectedScene.id}
              availableScenes={project?.scenes || []}
              onUpdate={(updatedHotspot) => 
                handleHotspotUpdate(selectedScene.id, updatedHotspot)
              }
              onClose={() => setSelectedHotspot(null)}
            />
          )}
        </div>
      </DashboardLayout>
    </AuthGuard>
  );
}
