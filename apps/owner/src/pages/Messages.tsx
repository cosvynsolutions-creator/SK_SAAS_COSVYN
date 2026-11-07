
import React, { useMemo } from 'react';
import { 
  BellRing, Mail, CheckCircle, Clock, ShieldCheck, Info, AlertTriangle, Loader2, Sparkles, UserCheck 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useGlobalCollection, useStreamCollection } from '../services/dbService';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { formatDateDDMMYYYY } from '../services/store';

const Messages = () => {
  const { currentUser } = useAuth();
  
  // Real data streams
  const { data: adminMessages = [], loading: l1 } = useGlobalCollection('admin_messages');
  const { data: readReceipts = [], loading: l2 } = useStreamCollection<any>('read_messages');
  
  // Need to know if this owner is active to filter targeted messages
  const [profile, setProfile] = React.useState<any>(null);
  
  React.useEffect(() => {
    if (currentUser) {
       getDoc(doc(db, 'businesses', currentUser.uid)).then(s => s.exists() && setProfile(s.data()));
    }
  }, [currentUser]);

  const filteredMessages = useMemo(() => {
    if (!currentUser || !profile) return [];
    
    return adminMessages.filter((msg: any) => {
      if (msg.channel === 'whatsapp' || msg.channel === 'email' || msg.isExternalCampaign) return false;
      const isGlobal = msg.targetType === 'ALL';
      const isActiveOnly = msg.targetType === 'ACTIVE' && profile.planStatus === 'Active';
      const isInactiveOnly = msg.targetType === 'INACTIVE' && profile.planStatus !== 'Active';
      const isSpecific = msg.targetType === 'SPECIFIC' && (
        msg.recipientId === currentUser.uid || 
        (msg.recipientIds && Array.isArray(msg.recipientIds) && msg.recipientIds.includes(currentUser.uid))
      );
      
      return isGlobal || isActiveOnly || isInactiveOnly || isSpecific;
    }).sort((a: any, b: any) => b.sentAt.localeCompare(a.sentAt));
  }, [adminMessages, currentUser, profile]);

  const readIds = useMemo(() => new Set(readReceipts.map(r => r.id)), [readReceipts]);

  const handleMarkRead = async (messageId: string) => {
    if (!currentUser) return;
    try {
      // Use deterministic ID to prevent duplicates
      const readRef = doc(db, 'businesses', currentUser.uid, 'read_messages', messageId);
      await setDoc(readRef, { 
        id: messageId,
        readAt: new Date().toISOString() 
      });
    } catch (err) {
      console.error("Error marking message as read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    if (!currentUser) return;
    const unread = filteredMessages.filter(m => !readIds.has(m.id));
    // Using Promise.all for faster execution of bulk reads
    await Promise.all(unread.map(m => handleMarkRead(m.id)));
  };

  if (l1 || l2 || !profile) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary-600" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 pt-2 animate-in fade-in duration-500">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
           <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <BellRing className="text-primary-600" /> Notifications from admin
           </h1>
           <p className="text-slate-500 font-medium mt-1">Direct updates and platform news from the ScaleKitchen team.</p>
        </div>
        {filteredMessages.length > 0 && (
           <button 
             onClick={handleMarkAllRead}
             className="text-[10px] font-black uppercase tracking-widest text-primary-600 hover:text-primary-800 transition-colors bg-primary-50 px-4 py-2 rounded-xl border border-primary-100"
           >
             Mark all as read
           </button>
        )}
      </div>

      <div className="space-y-4">
        {filteredMessages.map((msg: any) => {
          const isRead = readIds.has(msg.id);
          const isUrgent = msg.priority === 'urgent';
          const isWarning = msg.priority === 'warning';
          
          return (
            <div 
              key={msg.id} 
              className={`relative bg-white rounded-3xl p-6 border transition-all duration-300 ${
                isRead 
                  ? 'border-slate-100 opacity-80' 
                  : 'border-primary-200 shadow-xl shadow-primary-500/5 ring-1 ring-primary-100'
              }`}
            >
               {!isRead && (
                 <div className="absolute top-4 right-4 flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-primary-600 animate-ping" />
                    <span className="text-[10px] font-black text-primary-600 uppercase tracking-widest">New Message</span>
                 </div>
               )}

               <div className="flex gap-5">
                  <div className={`w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center ${
                    isUrgent ? 'bg-rose-50 text-rose-600' : isWarning ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                     {isUrgent ? <AlertTriangle size={28} /> : isWarning ? <Info size={28} /> : <ShieldCheck size={28} />}
                  </div>

                  <div className="flex-1">
                     <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2">
                        <h3 className={`text-xl font-black ${isRead ? 'text-slate-700' : 'text-slate-900'}`}>
                           {msg.title}
                        </h3>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                           <Clock size={12} /> {formatDateDDMMYYYY(msg.sentAt)}
                        </div>
                     </div>
                     
                     <p className={`text-sm leading-relaxed mb-6 whitespace-pre-line ${isRead ? 'text-slate-500' : 'text-slate-600'}`}>
                        {msg.content}
                     </p>

                     <div className="flex justify-between items-center">
                        <div className="flex gap-2">
                           <span className="bg-slate-50 text-slate-400 text-[9px] font-black uppercase px-2 py-1 rounded border border-slate-100">
                              System Broadcast
                           </span>
                           {msg.targetType === 'SPECIFIC' && (
                             <span className="bg-violet-50 text-violet-600 text-[9px] font-black uppercase px-2 py-1 rounded border border-violet-100 flex items-center gap-1">
                                <Sparkles size={10} /> Personal Note
                             </span>
                           )}
                        </div>

                        {!isRead && (
                          <button 
                            onClick={() => handleMarkRead(msg.id)}
                            className="flex items-center gap-2 bg-slate-900 hover:bg-black text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all transform active:scale-95 shadow-lg"
                          >
                             <CheckCircle size={14} /> Mark Read
                          </button>
                        )}
                        {isRead && (
                          <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                             <UserCheck size={14} /> Read
                          </div>
                        )}
                     </div>
                  </div>
               </div>
            </div>
          );
        })}

        {filteredMessages.length === 0 && (
           <div className="py-32 flex flex-col items-center justify-center text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-6">
                 <Mail size={48} />
              </div>
              <h3 className="text-2xl font-black text-slate-900">Your inbox is clear</h3>
              <p className="text-slate-500 mt-2 max-w-sm mx-auto font-medium">When the platform team sends you a message, it will appear here.</p>
           </div>
        )}
      </div>

    </div>
  );
};

export default Messages;
