
import React, { useState, useMemo } from 'react';
import { 
  Plus, Search, Loader2, Edit, Trash2, X, StickyNote, Calendar, ChevronDown, CheckCircle2, Circle, Pin, PinOff, Palette
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useStreamCollection, addItem, updateItem, deleteItem, getManagerBranchId } from '../services/dbService';
import { formatDateDDMMYYYY } from '../services/store';

const NOTE_COLORS = [
  { id: 'slate', bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-900', accent: 'bg-slate-200' },
  { id: 'blue', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', accent: 'bg-blue-200' },
  { id: 'amber', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', accent: 'bg-amber-200' },
  { id: 'rose', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-900', accent: 'bg-rose-200' },
  { id: 'emerald', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', accent: 'bg-emerald-200' },
];

const NoteCard = ({ note, branchName, onEdit, onDelete, onToggleStatus, onTogglePin }: any) => {
  const isDone = note.status === 'Done';
  const colorTheme = NOTE_COLORS.find(c => c.id === note.color) || NOTE_COLORS[0];

  return (
    <div className={`relative p-6 rounded-2xl border transition-all group flex flex-col justify-between h-full min-h-[200px] ${
      isDone ? 'border-slate-100 bg-slate-50/50' : `${colorTheme.bg} ${colorTheme.border} shadow-sm hover:shadow-md`
    }`}>
      {note.isPinned && !isDone && (
        <div className="absolute -top-2 -right-2 bg-primary-600 text-white p-1.5 rounded-full shadow-lg z-10">
          <Pin size={12} fill="currentColor" />
        </div>
      )}

      <div>
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onToggleStatus(note)}
              className={`transition-colors ${isDone ? 'text-green-500' : 'text-slate-300 hover:text-primary-500'}`}
            >
              {isDone ? <CheckCircle2 size={20} /> : <Circle size={20} />}
            </button>
            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md border ${
              isDone 
                ? 'text-slate-400 bg-slate-100 border-slate-200' 
                : 'text-primary-600 bg-white border-primary-100 shadow-xs'
            }`}>
              {branchName || 'General'}
            </span>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onTogglePin(note)} title={note.isPinned ? "Unpin" : "Pin to top"} className={`p-1.5 rounded-lg ${note.isPinned ? 'text-primary-600 bg-primary-50' : 'text-slate-400 hover:text-primary-600 hover:bg-white'}`}>
              {note.isPinned ? <Pin size={14} fill="currentColor"/> : <PinOff size={14}/>}
            </button>
            <button onClick={() => onEdit(note)} className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-white rounded-lg"><Edit size={14}/></button>
            <button onClick={() => onDelete(note.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg"><Trash2 size={14}/></button>
          </div>
        </div>
        <h3 className={`text-lg font-black leading-tight mb-2 truncate-2-lines transition-all ${
          isDone ? 'text-slate-400 line-through decoration-slate-300' : colorTheme.text
        }`}>
          {note.title}
        </h3>
        <p className={`text-sm line-clamp-4 leading-relaxed transition-all ${
          isDone ? 'text-slate-400' : 'text-slate-600'
        }`}>
          {note.content}
        </p>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-100/50 flex items-center justify-between text-[10px] font-bold text-slate-400">
        <div className="flex items-center gap-1.5">
          <Calendar size={12}/>
          <span>{formatDateDDMMYYYY(note.date)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${isDone ? 'bg-green-50 text-green-600' : 'bg-white text-slate-400 border border-slate-100'}`}>
            {note.status || 'Pending'}
          </span>
        </div>
      </div>
    </div>
  );
};

const Notes = () => {
  const { currentUser } = useAuth();
  const { data: notes = [], loading: l1 } = useStreamCollection<any>('notes');
  const { data: branches = [], loading: l2 } = useStreamCollection<any>('branches');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<any>(null);
  const [filters, setFilters] = useState({ branchId: getManagerBranchId() || 'All', search: '', status: 'All' });

  // Auto-lock branch filter when manager is assigned to a specific branch or single branch
  React.useEffect(() => {
    const mgrBranch = getManagerBranchId();
    if (mgrBranch && filters.branchId !== mgrBranch) {
      setFilters(prev => ({ ...prev, branchId: mgrBranch }));
    } else if (branches.length === 1 && filters.branchId !== branches[0].id) {
      setFilters(prev => ({ ...prev, branchId: branches[0].id }));
    }
  }, [branches, filters.branchId]);

  const isLoading = l1 || l2;

  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      const matchesBranch = filters.branchId === 'All' || n.branchId === filters.branchId;
      const matchesStatus = filters.status === 'All' || n.status === filters.status;
      const matchesSearch = (n.title || '').toLowerCase().includes(filters.search.toLowerCase()) || 
                           (n.content || '').toLowerCase().includes(filters.search.toLowerCase());
      return matchesBranch && matchesSearch && matchesStatus;
    }).sort((a, b) => {
      // 1. Pinned notes first
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      
      // 2. Pending notes before Done
      if (a.status === 'Pending' && b.status === 'Done') return -1;
      if (a.status === 'Done' && b.status === 'Pending') return 1;
      
      // 3. Newest first
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [notes, filters]);

  const handleSaveNote = async (data: any) => {
    if (!currentUser) return;
    if (editingNote) {
      await updateItem(currentUser.uid, 'notes', editingNote.id, data);
    } else {
      await addItem(currentUser.uid, 'notes', { 
        ...data, 
        status: 'Pending', 
        isPinned: false, 
        color: data.color || 'slate' 
      });
    }
    setIsModalOpen(false);
    setEditingNote(null);
  };

  const handleToggleNoteStatus = async (note: any) => {
    if (!currentUser) return;
    const newStatus = note.status === 'Done' ? 'Pending' : 'Done';
    await updateItem(currentUser.uid, 'notes', note.id, { status: newStatus });
  };

  const handleTogglePin = async (note: any) => {
    if (!currentUser) return;
    await updateItem(currentUser.uid, 'notes', note.id, { isPinned: !note.isPinned });
  };

  const handleDeleteNote = async (id: string) => {
    if (currentUser && window.confirm('Delete this note?')) {
      await deleteItem(currentUser.uid, 'notes', id);
    }
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary-600" /></div>;

  return (
    <div className="space-y-6 pb-20 pt-2 animate-in fade-in duration-500">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Business Notes</h1>
          <p className="text-slate-500 font-medium">Capture ideas, menu changes, and operational reminders.</p>
        </div>
        <button 
          onClick={() => { setEditingNote(null); setIsModalOpen(true); }}
          className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-primary-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          <Plus size={20} /> New Note
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-primary-500 text-slate-700 font-medium placeholder:text-slate-400 transition-all"
            placeholder="Search through your notes..."
            value={filters.search}
            onChange={(e) => setFilters({...filters, search: e.target.value})}
          />
        </div>
        <div className="relative">
          <select 
            className="w-full p-3.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold shadow-sm outline-none appearance-none pr-10 focus:ring-2 focus:ring-primary-500"
            value={filters.branchId}
            onChange={(e) => setFilters({...filters, branchId: e.target.value})}
          >
            {(!getManagerBranchId() && branches.length > 1) && <option value="All">All Branches</option>}
            {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
        </div>
        <div className="relative">
          <select 
            className="w-full p-3.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold shadow-sm outline-none appearance-none pr-10 focus:ring-2 focus:ring-primary-500"
            value={filters.status}
            onChange={(e) => setFilters({...filters, status: e.target.value})}
          >
            <option value="All">All Status</option>
            <option value="Pending">Pending Only</option>
            <option value="Done">Completed</option>
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredNotes.map(note => (
          <NoteCard 
            key={note.id} 
            note={note} 
            branchName={branches.find(b => b.id === note.branchId)?.name}
            onEdit={(n: any) => { setEditingNote(n); setIsModalOpen(true); }}
            onDelete={handleDeleteNote}
            onToggleStatus={handleToggleNoteStatus}
            onTogglePin={handleTogglePin}
          />
        ))}
        {filteredNotes.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mb-4">
              <StickyNote size={40} />
            </div>
            <h3 className="text-xl font-bold text-slate-900">No notes found</h3>
            <p className="text-slate-500 mt-1">Try adjusting your filters or add a new business note.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <NoteModal 
          branches={branches} 
          initialData={editingNote} 
          onClose={() => { setIsModalOpen(false); setEditingNote(null); }} 
          onSubmit={handleSaveNote} 
        />
      )}
    </div>
  );
};

const NoteModal = ({ branches, initialData, onClose, onSubmit }: any) => {
  const [formData, setFormData] = useState({
    branchId: branches[0]?.id || '',
    date: new Date().toISOString().split('T')[0],
    title: '',
    content: '',
    status: 'Pending',
    color: 'slate',
    isPinned: false,
    ...initialData
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl overflow-y-auto max-h-[95vh] relative text-left no-scrollbar">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-black text-slate-900">{initialData ? 'Edit Note' : 'Create Note'}</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><X size={24}/></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Branch</label>
              <select 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none font-bold text-slate-700 text-sm appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m4%206%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1rem_1rem] bg-[right_0.75rem_center] bg-no-repeat pr-8"
                value={formData.branchId} 
                onChange={e => setFormData({...formData, branchId: e.target.value})}
              >
                {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Date</label>
              <input 
                type="date" 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none font-bold text-slate-700 text-sm"
                value={formData.date} 
                onChange={e => setFormData({...formData, date: e.target.value})} 
              />
            </div>
          </div>
          
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Note Color</label>
            <div className="flex gap-3">
              {NOTE_COLORS.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setFormData({...formData, color: c.id})}
                  className={`w-10 h-10 rounded-xl border-2 transition-all flex items-center justify-center ${c.bg} ${formData.color === c.id ? 'border-primary-600 scale-110 shadow-md' : 'border-transparent'}`}
                >
                  <div className={`w-4 h-4 rounded-full ${c.accent.replace('bg-', 'bg-')}`} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Title</label>
            <input 
              required 
              placeholder="e.g. Menu Update for Next Week"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none font-black text-slate-900"
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})} 
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Content</label>
            <textarea 
              required 
              rows={5}
              placeholder="Detailed description or task list..."
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none font-medium text-slate-700 resize-none leading-relaxed"
              value={formData.content} 
              onChange={e => setFormData({...formData, content: e.target.value})} 
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button 
              type="button"
              onClick={() => setFormData({...formData, isPinned: !formData.isPinned})}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                formData.isPinned ? 'bg-primary-50 text-primary-600 border-primary-200' : 'bg-white text-slate-400 border-slate-200'
              }`}
            >
              <Pin size={14} fill={formData.isPinned ? "currentColor" : "none"} />
              {formData.isPinned ? 'Pinned to Top' : 'Pin to Top'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-100">
            <button type="button" onClick={onClose} className="py-3.5 border-2 border-slate-100 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-colors uppercase text-xs tracking-widest">Cancel</button>
            <button type="submit" className="py-3.5 bg-primary-600 text-white rounded-2xl font-bold shadow-lg shadow-primary-500/20 hover:bg-primary-700 transition-all active:scale-95 uppercase text-xs tracking-widest">Save Note</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Notes;
