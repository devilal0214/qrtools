import { Transaction } from '@/types/admin';

interface TransactionDetailsModalProps {
  transaction: Transaction;
  onClose: () => void;
}

export default function TransactionDetailsModal({ transaction, onClose }: TransactionDetailsModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Transaction Details</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">×</button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500">Transaction ID</label>
              <p className="text-sm">{transaction.id}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Status</label>
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full
                ${transaction.status === 'completed' ? 'bg-green-100 text-green-800' : 
                  transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'}`}>
                {transaction.status}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Amount</label>
              <p className="text-lg font-medium">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: transaction.currency
                }).format(transaction.amount)}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Gateway</label>
              <p className="text-sm">{transaction.gateway}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Gateway Transaction ID</label>
              <p className="text-sm font-mono">{transaction.gatewayTransactionId}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Date</label>
              <p className="text-sm">
                {new Date(transaction.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          <hr />

          <div>
            <label className="block text-sm font-medium text-gray-500">User ID</label>
            <p className="text-sm font-mono">{transaction.userId}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500">Plan ID</label>
            <p className="text-sm font-mono">{transaction.planId}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
