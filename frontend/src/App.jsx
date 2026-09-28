import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DashboardView from './pages/DashboardView';
import ScheduledReports from './pages/ScheduledReports';
import ScheduledGeneralReports from './pages/ScheduledGeneralReports';
import UserManagement from './pages/UserManagement';
import Profile from './pages/Profile';
import Dictionary from './pages/Dictionary';
import DataManagement from './pages/DataManagement';
import BukuRaport from './pages/BukuRaport';
import SyncPage from './pages/SyncPage';
import BIChat from './pages/BIChat';
import PromptManagement from './pages/PromptManagement';
import Templates from './pages/Templates';
import TemplateDetails from './pages/TemplateDetails';
import Broadcasts from './pages/Broadcasts';
import ChatbotSettings from './pages/ChatbotSettings';
import PersonaManager from './pages/PersonaManager';
import ContactManager from './pages/ContactManager';
import KnowledgeManager from './pages/KnowledgeManager';
import GroupAnalysis from './pages/GroupAnalysis';
import SettingsPage from './pages/SettingsPage';
import PromoManagement from './pages/PromoManagement';
import TelegramBotsManager from './pages/TelegramBotsManager';
import DataSourceManager from './pages/DataSourceManager';
import TaskMonitoringDashboard from './pages/TaskMonitoringDashboard';
import SalesCoverageMap from './pages/SalesCoverageMap';
import { DatabaseExplorer } from './pages/DatabaseExplorer/DatabaseExplorer';
import './index.css';

// Configure Axios interceptor for JWT
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<DashboardView />} />
          <Route path="/schedules" element={<ScheduledReports />} />
          <Route path="/general-schedules" element={<ScheduledGeneralReports />} />
          <Route path="/users" element={<UserManagement />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/dictionary" element={<Dictionary />} />
          <Route path="/raport" element={<BukuRaport />} />
          <Route path="/data-management" element={<DataManagement />} />
          <Route path="/data-sources" element={<DataSourceManager />} />
          <Route path="/sync" element={<SyncPage />} />
          <Route path="/bi-chat" element={<BIChat />} />
          <Route path="/prompts" element={<PromptManagement />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/templates/:id" element={<TemplateDetails />} />
          <Route path="/broadcasts" element={<Broadcasts />} />
          <Route path="/chatbot" element={<ChatbotSettings />} />
          <Route path="/personas" element={<PersonaManager />} />
          <Route path="/contacts" element={<ContactManager />} />
          <Route path="/knowledge" element={<KnowledgeManager />} />
          <Route path="/promos" element={<PromoManagement />} />
          <Route path="/group-analysis" element={<GroupAnalysis />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/telegram-bots" element={<TelegramBotsManager />} />
          <Route path="/task-monitoring" element={<TaskMonitoringDashboard />} />
          <Route path="/sales-coverage-map" element={<SalesCoverageMap />} />
          <Route path="/database-explorer" element={<DatabaseExplorer />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
