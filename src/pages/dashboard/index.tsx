// ...existing imports...
import { usePlanFeatures } from '@/hooks/usePlanFeatures';

export default function Dashboard() {
  const { planName, features, getRemainingQRCodes } = usePlanFeatures();
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    const fetchRemaining = async () => {
      const count = await getRemainingQRCodes();
      setRemaining(count);
    };
    fetchRemaining();
  }, []);

  return (
    <DashboardLayout>
      <div className="mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <p>Current Plan: {planName}</p>
          <p>Remaining QR Codes: {remaining}</p>
          {remaining <= 5 && (
            <Link href="/pricing" className="text-blue-600 hover:text-blue-700">
              Upgrade your plan for more QR codes →
            </Link>
          )}
        </div>
      </div>

      {/* ...rest of dashboard content... */}
    </DashboardLayout>
  );
}
