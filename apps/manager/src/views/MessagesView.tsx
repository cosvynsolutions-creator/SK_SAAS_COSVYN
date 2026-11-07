import React, { useState } from 'react';
import { MessageSquare, Send, Bell, Users, CheckCircle2 } from 'lucide-react';
import { useManagerAuth } from '../contexts/ManagerAuthContext';
import { useStreamCollection, addDocument } from '../services/dbService';
import { getTodayStr } from '../services/managerStore';

export const MessagesView: React.FC = () => {
  const { bizId, branchId, loggedInManager } = useManagerAuth();
  const { data: messages, loading } = useStreamCollection<any>('broadcasts');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await addDocument(bizId, 'broadcasts', {
        content: content.trim(),
        branchId,
        sender: loggedInManager?.name || 'Branch Manager',
        date: getTodayStr(),
        type: 'Announcement',
      });
      setContent('');
    } catch (err) {
      console.error("Broadcast error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="text-indigo-600" size={24} />
        <div>
          <h1 className="text-xl font-bold text-slate-900">Branch Broadcasts & Notices</h1>
          <p className="text-xs text-slate-500">Post announcements and updates for Branch: {branchId}</p>
        </div>
      </div>

      <form onSubmit={handleSendBroadcast} className="glass-card bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
          <Bell size={14} className="text-indigo-600" />
          <span>New Customer / Driver Announcement</span>
        </h3>
        <textarea
          rows={3}
          placeholder="e.g. Due to holiday celebrations, tomorrow lunch will be delivered between 11:30 AM and 1:00 PM."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs"
          >
            <Send size={13} /> {submitting ? 'Sending...' : 'Post Broadcast'}
          </button>
        </div>
      </form>

      <div className="space-y-3">
        <h3 className="font-bold text-xs text-slate-500 uppercase tracking-wider">Previous Announcements</h3>
        {loading ? (
          <div className="text-center py-8 text-slate-400 text-xs">Loading announcements...</div>
        ) : messages.length === 0 ? (
          <div className="glass-card bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
            No announcements broadcasted yet for this branch.
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className="glass-card bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span className="font-bold text-indigo-700">{msg.sender || 'Manager'}</span>
                <span>{msg.date}</span>
              </div>
              <p className="text-xs text-slate-800 leading-relaxed">{msg.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
