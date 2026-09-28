import { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { Camera, Save, Loader2, KeyRound } from 'lucide-react';

export default function Profile() {
  const currentUserStr = localStorage.getItem('user');
  const user = currentUserStr ? JSON.parse(currentUserStr) : null;
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(user?.profilePic ? `${API_URL}${user.profilePic}` : null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadError('');
    
    const formData = new FormData();
    formData.append('avatar', selectedFile);

    try {
      const res = await axios.post(`${API_URL}/api/profile/avatar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const updatedUser = { ...user, profilePic: res.data.profilePic };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setPreviewUrl(`${API_URL}${res.data.profilePic}`);
      setSelectedFile(null);
      // Small reload to refresh sidebar or header if they use profilePic
      window.location.reload(); 
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Failed to upload avatar');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setIsUpdatingPassword(true);
    setPasswordError('');
    setPasswordSuccess(false);

    try {
      await axios.put(`${API_URL}/api/profile/password`, {
        currentPassword,
        newPassword
      });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPasswordError(err.response?.data?.error || 'Failed to update password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden font-sans selection:bg-emerald-200">
      <header className="px-6 py-4 border-b border-slate-200 bg-white flex items-center shrink-0">
        <div>
          <h2 className="font-bold text-lg text-slate-800">My Profile</h2>
          <p className="text-xs text-slate-500">Manage your account settings</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center items-start">
        <div className="w-full max-w-3xl flex flex-col md:flex-row gap-6">
          
          {/* Avatar Section */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center flex-shrink-0 md:w-1/3">
            <div className="relative group mb-6">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-slate-50 bg-slate-100 flex items-center justify-center">
                {previewUrl ? (
                  <img src={previewUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-bold text-slate-300">{user.username.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <label className="absolute bottom-0 right-0 bg-emerald-600 text-white p-2 rounded-full cursor-pointer hover:bg-emerald-700 transition shadow-lg border-2 border-white">
                <Camera className="w-4 h-4" />
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
            </div>
            
            <h3 className="font-bold text-lg text-slate-800">{user.username}</h3>
            <p className="text-sm font-medium text-emerald-600 capitalize bg-emerald-50 px-3 py-1 rounded-full mt-1">
              {user.role.toLowerCase()}
            </p>

            {selectedFile && (
              <div className="mt-6 w-full flex flex-col gap-2">
                <button 
                  onClick={handleAvatarUpload}
                  disabled={isUploading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition disabled:opacity-50"
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Picture
                </button>
                <button 
                  onClick={() => { setSelectedFile(null); setPreviewUrl(user.profilePic ? `${API_URL}${user.profilePic}` : null); setUploadError(''); }}
                  className="w-full px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            )}
            {uploadError && <p className="text-rose-500 text-sm mt-3 text-center">{uploadError}</p>}
          </div>

          {/* Password Section */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex-1">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                <KeyRound className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-slate-800">Change Password</h3>
            </div>

            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
                <input 
                  type="password"
                  required
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 focus:bg-white transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                <input 
                  type="password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 focus:bg-white transition-colors"
                />
              </div>

              {passwordError && (
                <div className="text-sm text-rose-600 bg-rose-50 p-3 rounded-lg border border-rose-100">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="text-sm text-emerald-600 bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                  Password updated successfully.
                </div>
              )}

              <div className="pt-2">
                <button 
                  type="submit"
                  disabled={isUpdatingPassword || !currentPassword || !newPassword}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition shadow-sm disabled:opacity-50"
                >
                  {isUpdatingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
                  Update Password
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
