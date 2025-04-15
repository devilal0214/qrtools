import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export function ViewsChart() {
  const [viewData, setViewData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('week'); // week, month, year

  useEffect(() => {
    fetchViewData();
  }, [timeframe]);

  const fetchViewData = async () => {
    try {
      // Calculate date range based on timeframe
      const now = new Date();
      const startDate = new Date();
      switch (timeframe) {
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case 'year':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      // Query scans within date range
      const scanRef = collection(db, 'scans');
      const q = query(
        scanRef,
        where('timestamp', '>=', startDate.toISOString()),
        where('timestamp', '<=', now.toISOString()),
        orderBy('timestamp', 'asc')
      );
      
      const snapshot = await getDocs(q);
      
      // Group scans by date
      const groupedData = snapshot.docs.reduce((acc, doc) => {
        const date = new Date(doc.data().timestamp).toLocaleDateString();
        const existing = acc.find(item => item.date === date);
        if (existing) {
          existing.views++;
        } else {
          acc.push({ date, views: 1 });
        }
        return acc;
      }, []);

      // Fill in missing dates with zero views
      const filledData = fillMissingDates(groupedData, startDate, now);
      setViewData(filledData);
    } catch (error) {
      console.error('Error fetching view data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fillMissingDates = (data, startDate, endDate) => {
    const dateMap = new Map(data.map(item => [item.date, item.views]));
    const allDates = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dateStr = current.toLocaleDateString();
      allDates.push({
        date: dateStr,
        views: dateMap.get(dateStr) || 0
      });
      current.setDate(current.getDate() + 1);
    }

    return allDates;
  };

  if (loading) {
    return <div className="h-64 animate-pulse bg-gray-100 rounded-lg"></div>;
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">QR Code Views</h3>
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
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={viewData}>
            <defs>
              <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis 
              dataKey="date" 
              tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            />
            <YAxis />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="views"
              stroke="#3b82f6"
              fill="url(#viewsGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
