import React, { useState } from 'react';
import axios from 'axios';

const SaveToIssueModal = ({ isOpen, onClose, sourceModule, defaultTitle, queryParameters, initialSnapshot, aiSummary }) => {
  const [title, setTitle] = useState(defaultTitle || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    if (!title) {
      setError('Title is required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = {
        sourceModule,
        title,
        queryParameters,
        initialSnapshot,
        aiSummary,
        createdBy: 'user-id-placeholder' // We'll get the real user ID from the backend token decode ideally, but for now we pass a placeholder if not available.
      };
      
      // In a real app, the token interceptor sends JWT. The backend should ideally read `createdBy` from `req.user.id`.
      // Since our route requires `createdBy`, we will just decode it from token here or pass it if known.
      const token = localStorage.getItem('token');
      if (token) {
        const payloadStr = token.split('.')[1];
        try {
            const decoded = JSON.parse(atob(payloadStr));
            payload.createdBy = decoded.id; // assume user id is in the token
        } catch(e) {}
      }

      await axios.post('/api/issues', payload);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save issue');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Save to Issue Repository</h2>
        
        {success ? (
          <div className="bg-green-100 text-green-700 p-3 rounded mb-4">
            Issue saved successfully!
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">Issue Title</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border rounded focus:outline-none focus:border-blue-500"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Weekly Sales Drop in Depok"
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">Source Module</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border rounded bg-gray-100"
                value={sourceModule}
                readOnly
              />
            </div>

            {error && <div className="text-red-500 text-sm mb-4">{error}</div>}

            <div className="flex justify-end gap-2">
              <button 
                onClick={onClose}
                className="px-4 py-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300"
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 flex items-center"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Issue'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SaveToIssueModal;
