import { useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/DashboardLayout';
import { Scene, Hotspot } from '@/types/virtualTour';
import { uploadFile } from '@/utils/fileUpload';
import AuthGuard from '@/components/AuthGuard';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

export default function CreateVirtualTour() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [currentScene, setCurrentScene] = useState<Scene | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSceneUpload = async (file: File) => {
    try {
      setLoading(true);
      const url = await uploadFile(file);
      const newScene: Scene = {
        id: Math.random().toString(36).substr(2, 9),
        title: file.name,
        type: file.type.startsWith('video/') ? 'video' : 'image',
        content: url,
        hotspots: []
      };
      setScenes([...scenes, newScene]);
    } catch (error) {
      console.error('Error uploading scene:', error);
    } finally {
      setLoading(false);
    }
  };

  // ... Add more handlers for hotspots, scene management, etc.

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Save virtual tour data to Firestore
  };

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-6">Create Virtual Tour</h1>
          {/* Add form elements for tour creation */}
        </div>
      </DashboardLayout>
    </AuthGuard>
  );
}
