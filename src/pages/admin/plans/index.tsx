import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import Head from 'next/head';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Plan as PlanType } from '@/types/admin';
import AddEditPlanModal from '@/components/admin/AddEditPlanModal';

interface PlanModalData {
  isOpen: boolean;
  plan: PlanType | null;
}

export default function PlansPage() {
  const [plans, setPlans] = useState<PlanType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'plans'));
      const plansData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PlanType[];
      setPlans(plansData);
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePlan = async (planData: PlanType) => {
    try {
      if (planData.name === 'Free') {
        planData.enabledContentTypes = ['URL', 'CONTACT']; // Default free plan types
      }

      await addDoc(collection(db, 'plans'), {
        ...planData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      fetchPlans();
    } catch (error) {
      console.error('Error saving plan:', error);
    }
  };

  const addPlan = async (planData: Partial<PlanType>) => {
    try {
      await addDoc(collection(db, 'plans'), {
        ...planData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      fetchPlans();
    } catch (error) {
      console.error('Error adding plan:', error);
    }
  };

  const updatePlan = async (id: string, planData: Partial<PlanType>) => {
    try {
      await updateDoc(doc(db, 'plans', id), {
        ...planData,
        updatedAt: new Date().toISOString()
      });
      fetchPlans();
    } catch (error) {
      console.error('Error updating plan:', error);
    }
  };

  const deletePlan = async (id: string) => {
    if (!confirm('Are you sure you want to delete this plan?')) return;
    
    try {
      await deleteDoc(doc(db, 'plans', id));
      fetchPlans();
    } catch (error) {
      console.error('Error deleting plan:', error);
    }
  };

  return (
    <AdminLayout>
      <Head>
        <title>Plans Management - Admin Dashboard</title>
      </Head>

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Plans Management</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Add New Plan
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div key={plan.id} className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    <p className="text-2xl font-bold mt-2">
                      {plan.currency}{plan.price}
                      <span className="text-sm text-gray-500 font-normal">
                        /{plan.duration} days
                      </span>
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium
                    ${plan.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {plan.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div 
                  className="mt-4 text-sm text-gray-600 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: plan.description }}
                />

                <ul className="mt-4 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature.key} className="flex items-center text-sm text-gray-600">
                      <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>
                        {feature.label}: {feature.type === 'boolean' 
                          ? (feature.value ? 'Yes' : 'No')
                          : feature.value}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 flex gap-2">
                  <button
                    onClick={() => setSelectedPlan(plan)}
                    className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deletePlan(plan.id)}
                    className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddEditPlanModal
          onClose={() => setShowAddModal(false)}
          onSave={addPlan}
        />
      )}

      {selectedPlan && (
        <AddEditPlanModal
          plan={selectedPlan}
          onClose={() => setSelectedPlan(null)}
          onSave={(data) => updatePlan(selectedPlan.id, data)}
        />
      )}
    </AdminLayout>
  );
}
