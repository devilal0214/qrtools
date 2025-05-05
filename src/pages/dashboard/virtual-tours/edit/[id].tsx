import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { VirtualTourProject, Scene } from '@/types/virtualTour';
import DashboardLayout from '@/components/DashboardLayout';
import AuthGuard from '@/components/AuthGuard';
import SceneEditor from '@/components/virtualTour/SceneEditor';
import Head from 'next/head';
import { useAuth } from '@/hooks/useAuth';
import SceneUploader from '@/components/virtualTour/SceneUploader';
import SceneList from '@/components/virtualTour/SceneList';

export default function EditVirtualTour() {
  const [tour, setTour] = useState<VirtualTourProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();

  useEffect(() => {
    const fetchTour = async () => {
      if (!id || !user) return;

      try {
        setLoading(true);
        const tourDoc = await getDoc(doc(db, 'virtualTours', id as string));
        
        if (!tourDoc.exists()) {
          setError('Tour not found');
          return;
        }

        const tourData = tourDoc.data();
        
        // Check if user owns this tour
        if (tourData.userId !== user.uid) {
          setError('Access denied');
          return;
        }

        setTour({ id: tourDoc.id, ...tourData } as VirtualTourProject);
        if (tourData.scenes?.length > 0) {
          setScenes(tourData.scenes);
          setSelectedScene(tourData.scenes[0]);
        }

      } catch (err) {
        console.error('Error fetching tour:', err);
        setError('Failed to load tour');
      } finally {
        setLoading(false);
      }
    };

    fetchTour();
  }, [id, user]);

  const handleSceneUpdate = async (updatedScene: Scene) => {
    if (!tour || !user) return;

    try {
      const updatedScenes = scenes.map(scene =>
        scene.id === updatedScene.id ? updatedScene : scene
      );

      // Update in Firestore
      await updateDoc(doc(db, 'virtualTours', tour.id), {
        scenes: updatedScenes,
        updatedAt: new Date().toISOString()
      });

      // Update local state
      setScenes(updatedScenes);
      setSelectedScene(updatedScene);
      setTour(prev => prev ? { ...prev, scenes: updatedScenes } : null);

    } catch (error) {
      console.error('Error updating scene:', error);
      setError('Failed to update scene');
    }
  };

  const handleAddScene = async (newScene: Scene) => {
    if (!tour || !user) return;

    try {
      const updatedScenes = [...scenes, newScene];
      
      // Update in Firestore
      await updateDoc(doc(db, 'virtualTours', tour.id), {
        scenes: updatedScenes,
        updatedAt: new Date().toISOString()
      });

      // Update local state
      setScenes(updatedScenes);
      setSelectedScene(newScene);
      
    } catch (error) {
      console.error('Error adding scene:', error);
      setError('Failed to add scene');
    }
  };

  const handleDeleteTour = async () => {
    if (!tour || !confirm('Are you sure you want to delete this tour? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'virtualTours', tour.id));
      router.push('/dashboard/virtual-tours');
    } catch (error) {
      console.error('Error deleting tour:', error);
      setError('Failed to delete tour');
    }
  };

  const handleDeleteScene = async (sceneId: string) => {
    if (!tour || !confirm('Are you sure you want to delete this scene?')) {
      return;
    }

    try {
      const updatedScenes = scenes.filter(s => s.id !== sceneId);
      await updateDoc(doc(db, 'virtualTours', tour.id), {
        scenes: updatedScenes,
        updatedAt: new Date().toISOString()
      });

      setScenes(updatedScenes);
      if (selectedScene?.id === sceneId) {
        setSelectedScene(updatedScenes[0] || null);
      }
    } catch (error) {
      console.error('Error deleting scene:', error);
      setError('Failed to delete scene');
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

  if (error || !tour) {
    return (
      <AuthGuard>
        <DashboardLayout>
          <div className="p-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
              <p className="text-gray-600 mb-4">{error || 'Tour not found'}</p>
              <button
                onClick={() => router.push('/dashboard/virtual-tours')}
                className="text-blue-600 hover:text-blue-700"
              >
                Return to Virtual Tours
              </button>
            </div>
          </div>
        </DashboardLayout>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <DashboardLayout>
        <Head>
          <title>Edit {tour.title} - Virtual Tour</title>
        </Head>

        <div className="p-6 space-y-6">
          {/* Tour Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{tour.title}</h1>
              <p className="text-sm text-gray-500">Last updated: {new Date(tour.updatedAt).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => router.push(`/virtual-tour/${tour.id}`)}
                className="px-4 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
              >
                Preview Tour
              </button>
              <button
                onClick={() => router.push('/dashboard/virtual-tours')}
                className="px-4 py-2 text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100"
              >
                Back to Tours
              </button>
              <button
                onClick={handleDeleteTour}
                className="px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
              >
                Delete Tour
              </button>
            </div>
          </div>

          {/* Scene Management */}
          <div className="grid lg:grid-cols-4 gap-6">
            {/* Scene List */}
            <div className="space-y-4">
              <h2 className="font-medium text-gray-900">Scenes</h2>
              <div className="space-y-2">
                <SceneList
                  scenes={scenes}
                  currentSceneId={selectedScene?.id}
                  onSceneSelect={setSelectedScene}
                  onSceneDelete={handleDeleteScene}
                />
                <SceneUploader onSceneAdd={handleAddScene} />
              </div>
            </div>

            {/* Scene Editor */}
            <div className="lg:col-span-3">
              {selectedScene ? (
                <SceneEditor
                  scene={selectedScene}
                  scenes={scenes}
                  onUpdate={handleSceneUpdate}
                />
              ) : (
                <div className="bg-white rounded-xl p-6 text-center text-gray-500">
                  Select a scene to edit
                </div>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </AuthGuard>
  );
}
