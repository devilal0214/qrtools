import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import Head from 'next/head';
import { collection, getDocs, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PaymentGateway, PAYMENT_GATEWAYS } from '@/types/admin';
import toast from 'react-hot-toast';

export default function PaymentsSettings() {
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway | null>(null);
  const [ccavenueStatus, setCcavenueStatus] = useState<{
    configured: boolean;
    merchantId: string;
    accessCode: string;
    workingKey: string;
  } | null>(null);

  useEffect(() => {
    initializeGateways();
    checkCCAvenue();
  }, []);

  const initializeGateways = async () => {
    try {
      setLoading(true);
      
      // Create initial gateway documents if they don't exist
      for (const gateway of PAYMENT_GATEWAYS) {
        const gatewayRef = doc(db, 'payment_gateways', gateway.name);
        const gatewaySnap = await getDoc(gatewayRef);
        
        if (!gatewaySnap.exists()) {
          await setDoc(gatewayRef, {
            name: gateway.name,
            displayName: gateway.displayName,
            isActive: false,
            sandboxMode: true,
            credentials: {},
            updatedAt: new Date().toISOString()
          });
        }
      }

      // Fetch all gateways
      await fetchGateways();
    } catch (error) {
      console.error('Error initializing gateways:', error);
      toast.error('Failed to initialize payment gateways');
    } finally {
      setLoading(false);
    }
  };

  const fetchGateways = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'payment_gateways'));
      const gatewaysData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PaymentGateway[];
      setGateways(gatewaysData);
    } catch (error) {
      console.error('Error fetching gateways:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string, data: Partial<PaymentGateway>) => {
    try {
      const gatewayRef = doc(db, 'payment_gateways', id);
      const gatewaySnap = await getDoc(gatewayRef);

      if (!gatewaySnap.exists()) {
        // Create the document if it doesn't exist
        await setDoc(gatewayRef, {
          name: id,
          displayName: PAYMENT_GATEWAYS.find(g => g.name === id)?.displayName || id,
          isActive: data.isActive || false,
          sandboxMode: data.sandboxMode || true,
          credentials: data.credentials || {},
          updatedAt: new Date().toISOString()
        });
      } else {
        // Update existing document
        await updateDoc(gatewayRef, {
          ...data,
          updatedAt: new Date().toISOString()
        });
      }

      toast.success('Gateway settings updated successfully');
      await fetchGateways();
    } catch (error) {
      console.error('Error updating gateway:', error);
      toast.error('Failed to update gateway settings');
    }
  };

  const checkCCAvenue = async () => {
    try {
      const res = await fetch('/api/payments/check-ccavenue');
      const data = await res.json();
      setCcavenueStatus(data);
    } catch (error) {
      console.error('Error checking CCAvenue:', error);
    }
  };

  return (
    <AdminLayout>
      <Head>
        <title>Payment Gateways - Admin Dashboard</title>
      </Head>

      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Payment Gateways</h1>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {PAYMENT_GATEWAYS.map((gatewayConfig) => {
              const gateway = gateways.find(g => g.name === gatewayConfig.name) || {
                id: gatewayConfig.name,
                name: gatewayConfig.name,
                isActive: false,
                sandboxMode: true,
                credentials: {}
              };

              return (
                <div key={gateway.id} className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-lg font-bold">{gatewayConfig.displayName}</h3>
                      <p className="text-sm text-gray-500 mt-1">Configure your {gatewayConfig.displayName} integration</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={gateway.isActive}
                        onChange={(e) => handleUpdate(gateway.id, { isActive: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="space-y-4">
                    <label className="flex items-center gap-2 text-sm mb-4">
                      <input
                        type="checkbox"
                        checked={gateway.sandboxMode}
                        onChange={(e) => handleUpdate(gateway.id, { sandboxMode: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span>Sandbox/Test Mode</span>
                    </label>

                    {gatewayConfig.fields.map((field) => (
                      <div key={field.key}>
                        <label className="block text-sm font-medium text-gray-700">{field.label}</label>
                        <input
                          type={field.type}
                          value={gateway.credentials[field.key] || ''}
                          onChange={(e) => handleUpdate(gateway.id, {
                            credentials: {
                              ...gateway.credentials,
                              [field.key]: e.target.value
                            }
                          })}
                          className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder={`Enter ${field.label.toLowerCase()}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium mb-4">CCAvenue Status</h3>
          {ccavenueStatus ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2">
                Status: 
                <span className={ccavenueStatus.configured ? 'text-green-600' : 'text-red-600'}>
                  {ccavenueStatus.configured ? 'Configured' : 'Not Configured'}
                </span>
              </p>
              <ul className="text-sm text-gray-600">
                <li>Merchant ID: {ccavenueStatus.merchantId}</li>
                <li>Access Code: {ccavenueStatus.accessCode}</li>
                <li>Working Key: {ccavenueStatus.workingKey}</li>
              </ul>
            </div>
          ) : (
            <div className="text-gray-500">Checking CCAvenue configuration...</div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
