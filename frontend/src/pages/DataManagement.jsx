import React, { useState } from 'react';
import {
  Database, Eraser, ArrowRightLeft, Building2
} from 'lucide-react';
import { BackupRestoreTab } from '../components/DataManagement/BackupRestoreTab';
import { WriteOffTab } from '../components/DataManagement/WriteOffTab';
import { MigrateTab } from '../components/DataManagement/MigrateTab';

export default function DataManagement() {
  const [activeTab, setActiveTab] = useState('backup');

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-slate-50/50">
      <header className="bg-white border-b border-slate-200 py-5 shrink-0">
        <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">Data Management</h1>
              <p className="text-sm text-slate-500 mt-1">Backup database, restore, dan write-off/reset data</p>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 mt-4 bg-slate-100 rounded-xl p-1 w-full sm:w-fit overflow-x-auto">
            <button
              onClick={() => setActiveTab('backup')}
              className={`flex-1 sm:flex-initial flex items-center justify-center whitespace-nowrap gap-2 px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'backup'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Database className="w-4 h-4" />
              Backup & Restore
            </button>
            <button
              onClick={() => setActiveTab('writeoff')}
              className={`flex-1 sm:flex-initial flex items-center justify-center whitespace-nowrap gap-2 px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'writeoff'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Eraser className="w-4 h-4" />
              Write-Off / Reset
            </button>
            <button
              onClick={() => setActiveTab('migrate')}
              className={`flex-1 sm:flex-initial flex items-center justify-center whitespace-nowrap gap-2 px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'migrate'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              Migrate Data
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto py-6 sm:py-8">
        <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-12">
          {activeTab === 'backup' && <BackupRestoreTab />}
          {activeTab === 'writeoff' && <WriteOffTab />}
          {activeTab === 'migrate' && <MigrateTab />}
        </div>
      </main>
    </div>
  );
}
