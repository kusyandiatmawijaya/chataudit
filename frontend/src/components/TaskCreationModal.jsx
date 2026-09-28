import React, { useState, useEffect } from 'react';
import axios from 'axios';

const TaskCreationModal = ({ isOpen, onClose, onTaskCreated }) => {
  const [issues, setIssues] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedIssue, setSelectedIssue] = useState('');
  const [selectedPic, setSelectedPic] = useState('');
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchIssues();
      fetchUsers();
    }
  }, [isOpen]);

  const fetchIssues = async () => {
    try {
      const { data } = await axios.get('/api/issues');
      // Only keep issues that are open (either 0 tasks, or none are in progress/open)
      // Actually, if an issue has tasks, check if any task is OPEN or OPEN_CONTINUE.
      // If we want issues that don't have active tasks:
      const openIssues = data.issues.filter(issue => {
        if (!issue.tasks || issue.tasks.length === 0) return true;
        const hasOpenTask = issue.tasks.some(t => t.status === 'OPEN' || t.status === 'OPEN_CONTINUE');
        return !hasOpenTask;
      });
      setIssues(openIssues);
    } catch (err) {
      console.error('Failed to fetch issues', err);
    }
  };

  const fetchUsers = async () => {
    try {
      // Assuming there's a user endpoint or just mock for now
      // Let's fetch from /api/users
      const { data } = await axios.get('/api/users');
      setUsers(data.users || data || []);
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  };

  const handleCreate = async () => {
    if (!selectedIssue || !selectedPic || !deadline) {
      setError('Please fill all fields');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let assignerId = 'user-id-placeholder';
      const token = localStorage.getItem('token');
      if (token) {
        try {
            const decoded = JSON.parse(atob(token.split('.')[1]));
            assignerId = decoded.id;
        } catch(e) {}
      }

      await axios.post('/api/tasks', {
        issueId: selectedIssue,
        picId: selectedPic,
        assignerId,
        deadline
      });
      onTaskCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Create New Task</h2>
        
        {error && <div className="text-red-500 text-sm mb-4">{error}</div>}

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">Select Issue</label>
          <select 
            className="w-full px-3 py-2 border rounded focus:outline-none focus:border-blue-500"
            value={selectedIssue}
            onChange={(e) => setSelectedIssue(e.target.value)}
          >
            <option value="">-- Choose Issue --</option>
            {issues.map(issue => (
              <option key={issue.id} value={issue.id}>{issue.title} ({issue.sourceModule})</option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">Assign PIC</label>
          <select 
            className="w-full px-3 py-2 border rounded focus:outline-none focus:border-blue-500"
            value={selectedPic}
            onChange={(e) => setSelectedPic(e.target.value)}
          >
            <option value="">-- Choose User --</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.username}</option>
            ))}
            {/* Fallback option in case /api/users doesn't load */}
            {users.length === 0 && <option value="user-id-placeholder">Dummy User</option>}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">Deadline</label>
          <input 
            type="date" 
            className="w-full px-3 py-2 border rounded focus:outline-none focus:border-blue-500"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>



        <div className="flex justify-end gap-2">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300"
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            onClick={handleCreate}
            className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 flex items-center"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskCreationModal;
