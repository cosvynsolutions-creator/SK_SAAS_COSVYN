
import React, { useState, useEffect } from 'react';
import { Shield, Lock, Mail, User, Check, X, Edit2, Camera } from 'lucide-react';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const AdminProfile = () => {
  const { currentUser } = useAdminAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [userData, setUserData] = useState({
     name: currentUser?.displayName || 'Admin',
     email: currentUser?.email || '',
     role: 'Super Admin',
     avatarUrl: currentUser?.photoURL || ''
  });

  // Load from local storage on mount to persist changes (Mocking persistence for profile metadata since Auth profile update requires more logic)
  useEffect(() => {
     const savedAvatar = localStorage.getItem('admin_avatar_url');
     if (savedAvatar) {
        setUserData(prev => ({ ...prev, avatarUrl: savedAvatar }));
     }
  }, []);

  const handleSave = () => {
    setIsEditing(false);
    // Persist avatar change to localStorage for other components to pick up
    if (userData.avatarUrl) {
       localStorage.setItem('admin_avatar_url', userData.avatarUrl);
       // Dispatch storage event to update header immediately
       window.dispatchEvent(new Event('storage'));
    }
    alert('Admin profile updated locally! (Auth profile update requires re-authentication)');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
       
       <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-8 backdrop-blur-sm text-center relative">
          <div className="absolute top-6 right-6">
             {!isEditing ? (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                >
                   <Edit2 size={18} />
                </button>
             ) : (
                <div className="flex gap-2">
                   <button onClick={() => setIsEditing(false)} className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20"><X size={18}/></button>
                   <button onClick={handleSave} className="p-2 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20"><Check size={18}/></button>
                </div>
             )}
          </div>

          <div className="relative w-24 h-24 mx-auto mb-4 group">
             <div className="w-full h-full rounded-full bg-slate-800 border-4 border-slate-700 overflow-hidden shadow-xl">
                <img src={userData.avatarUrl || 'https://ui-avatars.com/api/?name=Admin&background=0D8ABC&color=fff'} alt="Admin" className="w-full h-full object-cover" />
             </div>
             {isEditing && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                   <Camera className="text-white" size={24} />
                </div>
             )}
          </div>
          
          {isEditing ? (
             <div className="flex flex-col gap-3 max-w-sm mx-auto">
                <input 
                  className="bg-slate-950 border border-slate-700 text-white text-center font-bold text-xl rounded-lg p-2 outline-none focus:border-cyan-500 placeholder:text-slate-600"
                  value={userData.name}
                  onChange={e => setUserData({...userData, name: e.target.value})}
                  placeholder="Admin Name"
                />
                <input 
                  className="bg-slate-950 border border-slate-700 text-cyan-400 text-center font-medium text-sm rounded-lg p-2 outline-none focus:border-cyan-500 placeholder:text-slate-600"
                  value={userData.role}
                  onChange={e => setUserData({...userData, role: e.target.value})}
                  placeholder="Role Title"
                />
                <input 
                  className="bg-slate-950 border border-slate-700 text-slate-300 text-center text-xs rounded-lg p-2 outline-none focus:border-cyan-500 placeholder:text-slate-600"
                  value={userData.avatarUrl}
                  onChange={e => setUserData({...userData, avatarUrl: e.target.value})}
                  placeholder="Paste Avatar Image URL"
                />
             </div>
          ) : (
             <>
                <h2 className="text-2xl font-bold text-white">{userData.name}</h2>
                <p className="text-cyan-400 font-medium">{userData.role}</p>
             </>
          )}
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
             <h3 className="text-slate-400 text-sm uppercase font-bold mb-4 flex items-center gap-2">
                <User size={16} /> Personal Details
             </h3>
             <div className="space-y-4">
                <div>
                   <label className="text-xs text-slate-500 block mb-1">Full Name</label>
                   <input 
                     disabled={!isEditing}
                     className="w-full text-white font-medium bg-slate-950/50 p-2 rounded border border-slate-800 disabled:opacity-70 disabled:cursor-not-allowed outline-none focus:border-cyan-500 transition-all"
                     value={userData.name}
                     onChange={e => setUserData({...userData, name: e.target.value})}
                   />
                </div>
                <div>
                   <label className="text-xs text-slate-500 block mb-1">Email Address</label>
                   <div className="relative">
                      <Mail size={14} className="absolute left-3 top-3 text-slate-600"/> 
                      <input 
                        disabled
                        className="w-full pl-9 text-white font-medium bg-slate-950/50 p-2 rounded border border-slate-800 disabled:opacity-70 disabled:cursor-not-allowed outline-none transition-all cursor-not-allowed"
                        value={userData.email}
                      />
                   </div>
                </div>
             </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
             <h3 className="text-slate-400 text-sm uppercase font-bold mb-4 flex items-center gap-2">
                <Shield size={16} /> Security & System
             </h3>
             <div className="space-y-4">
                <div>
                   <label className="text-xs text-slate-500 block mb-1">Access Level</label>
                   <div className="text-emerald-400 font-bold text-sm bg-emerald-500/10 p-2 rounded border border-emerald-500/20 inline-block">
                      Root / Super Admin
                   </div>
                </div>
                <div className="pt-2">
                   <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800/50">
                      <Lock size={18} className="text-slate-500" />
                      <div className="text-xs text-slate-500">
                         Two-Factor Authentication is <span className="text-white font-bold">Enabled</span>
                      </div>
                   </div>
                </div>
             </div>
          </div>
       </div>

    </div>
  );
};

export default AdminProfile;
