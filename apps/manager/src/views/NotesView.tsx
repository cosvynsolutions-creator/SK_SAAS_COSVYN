import React, { useState } from 'react';
import { FileText, Plus, AlertCircle, Trash2, Calendar } from 'lucide-react';
import { useManagerAuth } from '../contexts/ManagerAuthContext';
import { useStreamCollection, addDocument, deleteDocument } from '../services/dbService';
import { getTodayStr } from '../services/managerStore';

export const NotesView: React.FC = () => {
  const { bizId, branchId, loggedInManager } = useManagerAuth();
  const { data: notes, loading } = useStreamCollection<any>('notes');
  const [newNote, setNewNote] = useState('');
  const [tag, setTag] = useState<'General' | 'Dietary Alert' | 'Kitchen Memo' | 'Delivery Notice'>('General');
  const [submitting, setSubmitting] = useState(false);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setSubmitting(true);
    try {
      await addDocument(bizId, 'notes', {
        content: newNote.trim(),
        tag,
        branchId,
        author: loggedInManager?.name || 'Branch Manager',
        date: getTodayStr(),
      });
      setNewNote('');
    } catch (err) {
      console.error("Failed to add note:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this kitchen memo?")) return;
    try {
      await deleteDocument(bizId, 'notes', id);
    } catch (err) {
      console.error("Failed to delete note:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FileText className="text-indigo-600" size={24} />
        <div>
          <h1 className="text-xl font-bold text-slate-900">Kitchen Memos & Dietary Notes</h1>
          <p className="text-xs text-slate-500">Daily instructions and alerts for Branch: {branchId}</p>
        </div>
      </div>

      {/* Add Note Form */}
      <form onSubmit={handleAddNote} className="glass-card bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
          <Plus size={14} className="text-indigo-600" />
          <span>Post Kitchen Operational Note</span>
        </h3>
        <div className="flex flex-wrap gap-2">
          {(['General', 'Dietary Alert', 'Kitchen Memo', 'Delivery Notice'] as const).map(t => (
            <button
              type="button"
              key={t}
              onClick={() => setTag(t)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                tag === t
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <textarea
          rows={2}
          placeholder="e.g. Table 4 customer requested less oil and salt; Rider alert: heavy rain on Sector 14 route..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting || !newNote.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-2xs"
          >
            {submitting ? 'Posting...' : 'Save Note'}
          </button>
        </div>
      </form>

      {/* Notes List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 text-center py-12 text-slate-400 text-xs">Loading notes...</div>
        ) : notes.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-slate-400 text-xs">No active notes for this branch.</div>
        ) : (
          notes.map(note => (
            <div key={note.id} className="glass-card bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2 relative">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {note.tag || 'General'}
                </span>
                <button
                  onClick={() => handleDelete(note.id)}
                  className="text-slate-400 hover:text-rose-600 p-1"
                  title="Delete note"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">{note.content}</p>
              <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span>By: {note.author || 'Manager'}</span>
                <span>{note.date}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
