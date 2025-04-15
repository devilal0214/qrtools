import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

export function SalesChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('week'); // week, month, year

  useEffect(() => {
    const fetchSalesData = async () => {
      try {
        // Get date range based on timeframe
        const startDate = getStartDate(timeframe);
        
        const q = query(
          collection(db, 'transactions'),
          where('status', '==', 'completed'),
          where('createdAt', '>=', startDate.toISOString()),
          orderBy('createdAt', 'asc') // Changed to asc for chronological order
        );
        
        const snapshot = await getDocs(q);
        const transactions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Process data for chart
        const chartData = processTransactions(transactions, timeframe);
        setData(chartData);
      } catch (error) {
        console.error('Error fetching sales data:', error);
        // Add more detailed error logging
        if (error.code === 'failed-precondition') {
          console.log('Please create the required index for transactions collection');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSalesData();
  }, [timeframe]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6">
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">Sales Overview</h3>
        <select
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value)}
          className="px-3 py-1 border rounded-lg"
        >
          <option value="week">Last 7 days</option>
          <option value="month">Last 30 days</option>
          <option value="year">Last 12 months</option>
        </select>
      </div>

      <div className="h-64">
        {/* Add your preferred chart library here */}
        {/* Example: Chart.js, Recharts, etc. */}
        <p className="text-center text-gray-500">Chart goes here</p>
      </div>
    </div>
  );
}

function getStartDate(timeframe: string) {
  const date = new Date();
  switch (timeframe) {
    case 'week':
      date.setDate(date.getDate() - 7);
      break;
    case 'month':
      date.setDate(date.getDate() - 30);
      break;
    case 'year':
      date.setFullYear(date.getFullYear() - 1);
      break;
  }
  return date;
}

function processTransactions(transactions: any[], timeframe: string) {
  // Process transactions based on timeframe
  // Return data in format needed by your chart library
  return [];
}
