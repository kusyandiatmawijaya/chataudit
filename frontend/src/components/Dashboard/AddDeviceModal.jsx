import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export function AddDeviceModal({ isOpen, onClose, onAdd }) {
  const [newDeviceName, setNewDeviceName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newDeviceName.trim()) return;
    setIsAdding(true);
    await onAdd(newDeviceName);
    setIsAdding(false);
    setNewDeviceName('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Device">
      <form onSubmit={handleSubmit} className="p-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Salesman / Device Name</label>
          <input 
            type="text" 
            autoFocus
            required
            placeholder="e.g. Salesman Budi"
            value={newDeviceName}
            onChange={(e) => setNewDeviceName(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
          />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={isAdding || !newDeviceName.trim()}
          >
            {isAdding && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Generate QR
          </Button>
        </div>
      </form>
    </Modal>
  );
}
