import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { Clock, Power, PowerOff, Save, Loader2, RefreshCw, Eye } from 'lucide-react';

export default function ScheduledGeneralReports() {
    const [schedules, setSchedules] = useState([]);
    const [telegramBots, setTelegramBots] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPreviewing, setIsPreviewing] = useState(false);

    useEffect(() => {
        initAndFetchSchedules();
    }, []);

    const initAndFetchSchedules = async () => {
        setIsLoading(true);
        try {
            // Ensure salesman_monthly is created if it doesn't exist
            await axios.post(`${API_URL}/api/general-report-schedules/init`);
            await Promise.all([
                fetchSchedules(),
                fetchTelegramBots()
            ]);
        } catch (error) {
            console.error('Failed to init general schedules', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchTelegramBots = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/telegram-bots`);
            setTelegramBots(res.data.filter(bot => bot.isActive));
        } catch (error) {
            console.error('Failed to fetch telegram bots', error);
        }
    };

    const fetchSchedules = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/general-report-schedules`);
            setSchedules(res.data);
        } catch (error) {
            console.error('Failed to fetch general schedules', error);
        }
    };

    const handleToggleActive = async (id, currentStatus) => {
        try {
            await axios.patch(`${API_URL}/api/general-report-schedules/${id}`, { isActive: !currentStatus });
            fetchSchedules();
        } catch (err) {
            console.error('Failed to toggle status', err);
        }
    };

    const handleTimeChange = async (id, newTime) => {
        try {
            await axios.patch(`${API_URL}/api/general-report-schedules/${id}`, { scheduleTime: newTime });
            fetchSchedules();
        } catch (err) {
            console.error('Failed to update time', err);
        }
    };

    const handleBotChange = async (id, newSenderSessionId) => {
        try {
            await axios.patch(`${API_URL}/api/general-report-schedules/${id}`, { senderSessionId: newSenderSessionId });
            fetchSchedules();
        } catch (err) {
            console.error('Failed to update bot', err);
        }
    };

    const handlePreview = async (reportId) => {
        setIsPreviewing(true);
        try {
            const response = await axios.get(`${API_URL}/api/general-report-schedules/preview/${reportId}`, {
                responseType: 'blob'
            });
            const fileURL = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            window.open(fileURL, '_blank');
        } catch (err) {
            console.error('Failed to fetch preview', err);
            alert('Gagal membuat preview laporan.');
        } finally {
            setIsPreviewing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="animate-spin text-blue-500 w-8 h-8" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Scheduled General Reports</h1>
                    <p className="text-gray-500">Manage internal background reporting schedules (e.g., Salesman Monthly Report).</p>
                </div>
                <button
                    onClick={fetchSchedules}
                    className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                    <RefreshCw className="w-4 h-4 text-gray-600" />
                    <span>Refresh</span>
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100 text-gray-600">
                                <th className="p-4 font-semibold text-sm">Report Name</th>
                                <th className="p-4 font-semibold text-sm text-center">Identifier</th>
                                <th className="p-4 font-semibold text-sm text-center">Schedule Time (WIB)</th>
                                <th className="p-4 font-semibold text-sm text-center">Sender Bot</th>
                                <th className="p-4 font-semibold text-sm text-center">Status</th>
                                <th className="p-4 font-semibold text-sm text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {schedules.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-gray-400">
                                        No general schedules found.
                                    </td>
                                </tr>
                            ) : (
                                schedules.map((schedule) => (
                                    <tr key={schedule.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                        <td className="p-4">
                                            <div className="font-medium text-gray-800">{schedule.name}</div>
                                            <div className="text-xs text-gray-400 mt-1">ID: {schedule.id}</div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded font-mono">
                                                {schedule.reportId}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center space-x-2">
                                                <Clock className="w-4 h-4 text-gray-400" />
                                                <input
                                                    type="time"
                                                    defaultValue={schedule.scheduleTime}
                                                    onBlur={(e) => {
                                                        if (e.target.value !== schedule.scheduleTime) {
                                                            handleTimeChange(schedule.id, e.target.value);
                                                        }
                                                    }}
                                                    className="border border-gray-300 rounded p-1 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                />
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <select
                                                value={schedule.senderSessionId || ''}
                                                onChange={(e) => handleBotChange(schedule.id, e.target.value)}
                                                className="border border-gray-300 rounded p-1 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none max-w-xs"
                                            >
                                                <option value="">Default (telegram-main)</option>
                                                {telegramBots.map((bot) => (
                                                    <option key={bot.id} value={`telegram-${bot.id}`}>
                                                        {bot.name || `Bot (${bot.type})`}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="p-4 text-center">
                                            {schedule.isActive ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                    Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center space-x-2">
                                                <button
                                                    onClick={() => handlePreview(schedule.reportId)}
                                                    disabled={isPreviewing}
                                                    className={`p-2 rounded-lg transition-colors ${
                                                        isPreviewing ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                                    }`}
                                                    title="Preview Report"
                                                >
                                                    {isPreviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                                <button
                                                    onClick={() => handleToggleActive(schedule.id, schedule.isActive)}
                                                    className={`p-2 rounded-lg transition-colors ${
                                                        schedule.isActive
                                                            ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                                            : 'bg-green-50 text-green-600 hover:bg-green-100'
                                                    }`}
                                                    title={schedule.isActive ? 'Disable Schedule' : 'Enable Schedule'}
                                                >
                                                    {schedule.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
