
import React, { useState } from 'react';
import { 
  MessageSquare, Star, Lightbulb, AlertCircle, Clock 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useGlobalCollection, addGlobalItem } from '../services/dbService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { formatDateDDMMYYYY } from '../services/store';

const Support = () => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'features' | 'support' | 'reviews'>('features');
  
  // REAL DB HOOKS
  const { data: featureRequests } = useGlobalCollection('global_features');
  const { data: supportTickets } = useGlobalCollection('global_tickets');
  const { data: reviews } = useGlobalCollection('global_reviews');

  // Form States
  const [featureForm, setFeatureForm] = useState({ name: '', desc: '' });
  const [ticketForm, setTicketForm] = useState({ type: 'Technical', desc: '' });
  const [reviewForm, setReviewForm] = useState({ rating: 5, text: '' });

  // Helper to get Business Name
  const [businessName, setBusinessName] = useState('My Business');
  React.useEffect(() => {
     if(currentUser) {
        getDoc(doc(db, 'businesses', currentUser.uid)).then(s => {
           if(s.exists()) setBusinessName(s.data().businessName);
        });
     }
  }, [currentUser]);

  // --- HANDLERS ---

  const handleAddFeature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!featureForm.name || !featureForm.desc || !currentUser) return;
    
    await addGlobalItem('global_features', {
      tenantId: currentUser.uid,
      businessName,
      featureName: featureForm.name,
      description: featureForm.desc,
      status: 'Pending',
    });
    setFeatureForm({ name: '', desc: '' });
  };

  const handleAddTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketForm.desc || !currentUser) return;
    
    await addGlobalItem('global_tickets', {
      tenantId: currentUser.uid,
      businessName,
      issueType: ticketForm.type,
      description: ticketForm.desc,
      status: 'Open',
    });
    setTicketForm({ type: 'Technical', desc: '' });
  };

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewForm.text || !currentUser) return;
    
    await addGlobalItem('global_reviews', {
      tenantId: currentUser.uid,
      businessName,
      rating: reviewForm.rating,
      reviewText: reviewForm.text,
    });
    setReviewForm({ rating: 5, text: '' });
  };

  const myFeatures = featureRequests.filter(f => f.tenantId === currentUser?.uid);
  const myTickets = supportTickets.filter(t => t.tenantId === currentUser?.uid);
  const myReviews = reviews.filter(r => r.tenantId === currentUser?.uid);

  return (
    <div className="space-y-6 pb-20">
      
      {/* 1. Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Support & Feedback</h1>
        <p className="text-slate-500">Get help, request features, or rate your experience.</p>
      </div>

      {/* 2. Tabs Navigation */}
      <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl">
        <button 
          onClick={() => setActiveTab('features')}
          className={`py-2.5 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'features' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Features
        </button>
        <button 
          onClick={() => setActiveTab('support')}
          className={`py-2.5 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'support' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Tickets
        </button>
        <button 
          onClick={() => setActiveTab('reviews')}
          className={`py-2.5 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'reviews' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Reviews
        </button>
      </div>

      {/* 3. Tab Content */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        
        {/* === FEATURE REQUESTS TAB === */}
        {activeTab === 'features' && (
          <div className="space-y-6">
            {/* Form */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Lightbulb size={20} className="text-yellow-500" /> Request a Feature
              </h3>
              <form onSubmit={handleAddFeature} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Feature Name</label>
                  <input 
                    type="text" placeholder="e.g. Dark Mode" 
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-slate-900 bg-white"
                    value={featureForm.name} onChange={e => setFeatureForm({...featureForm, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                  <textarea 
                    rows={3} placeholder="Describe how this would help you..."
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-slate-900 bg-white resize-none"
                    value={featureForm.desc} onChange={e => setFeatureForm({...featureForm, desc: e.target.value})}
                  />
                </div>
                <button type="submit" className="w-full bg-gradient-to-r from-primary-600 to-violet-600 text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-primary-500/25 transition-all">
                  Submit Request
                </button>
              </form>
            </div>

            {/* List */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-500 uppercase px-1">Your Requests</h4>
              {myFeatures.map((req: any) => (
                <div key={req.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-start">
                  <div>
                    <h5 className="font-bold text-slate-900">{req.featureName}</h5>
                    <p className="text-sm text-slate-600 mt-1">{req.description}</p>
                    <p className="text-xs text-slate-400 mt-2">{formatDateDDMMYYYY(req.createdAt)}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    req.status === 'Approved' ? 'bg-green-100 text-green-700' :
                    req.status === 'Processing' ? 'bg-blue-100 text-blue-700' :
                    req.status === 'Delayed' ? 'bg-orange-100 text-orange-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {req.status}
                  </span>
                </div>
              ))}
              {myFeatures.length === 0 && <p className="text-center text-slate-400 italic py-4">No requests yet.</p>}
            </div>
          </div>
        )}

        {/* === SUPPORT TICKETS TAB === */}
        {activeTab === 'support' && (
          <div className="space-y-6">
            {/* Form */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <AlertCircle size={20} className="text-red-500" /> Open a Ticket
              </h3>
              <form onSubmit={handleAddTicket} className="space-y-4">
                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Issue Type</label>
                   <select 
                     className="w-full p-2.5 border border-slate-200 rounded-lg text-slate-900 bg-white"
                     value={ticketForm.type} onChange={e => setTicketForm({...ticketForm, type: e.target.value})}
                   >
                     <option>Technical</option>
                     <option>Billing</option>
                     <option>Delivery</option>
                     <option>Other</option>
                   </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                  <textarea 
                    rows={3} placeholder="Describe the issue in detail..."
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-slate-900 bg-white resize-none"
                    value={ticketForm.desc} onChange={e => setTicketForm({...ticketForm, desc: e.target.value})}
                  />
                </div>
                <div className="border border-dashed border-slate-300 rounded-lg p-4 text-center text-sm text-slate-500 cursor-not-allowed bg-slate-50">
                   Attach Screenshot (Coming Soon)
                </div>
                <button type="submit" className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-slate-800 transition-all">
                  Submit Ticket
                </button>
              </form>
            </div>

            {/* List */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-500 uppercase px-1">Recent Tickets</h4>
              {myTickets.map((ticket: any) => (
                <div key={ticket.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                   <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-slate-900">{ticket.issueType} Issue</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        ticket.status === 'Resolved' ? 'bg-green-100 text-green-700' :
                        ticket.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {ticket.status}
                      </span>
                   </div>
                   <p className="text-sm text-slate-600">{ticket.description}</p>
                   <div className="mt-3 pt-3 border-t border-slate-50 flex items-center gap-2 text-xs text-slate-400">
                      <Clock size={12} /> Opened on {formatDateDDMMYYYY(ticket.createdAt)}
                   </div>
                </div>
              ))}
              {myTickets.length === 0 && <p className="text-center text-slate-400 italic py-4">No support tickets found.</p>}
            </div>
          </div>
        )}

        {/* === REVIEWS TAB === */}
        {activeTab === 'reviews' && (
          <div className="space-y-6">
            {/* Form */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Star size={20} className="text-yellow-500" fill="currentColor" /> Rate COSVYN
              </h3>
              <form onSubmit={handleAddReview} className="space-y-4">
                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Rating</label>
                   <div className="flex gap-2">
                     {[1, 2, 3, 4, 5].map((star) => (
                       <button 
                         key={star} type="button"
                         onClick={() => setReviewForm({...reviewForm, rating: star})}
                         className="focus:outline-none transition-transform hover:scale-110"
                       >
                         <Star 
                           size={32} 
                           className={star <= reviewForm.rating ? "text-yellow-400" : "text-slate-200"} 
                           fill="currentColor"
                         />
                       </button>
                     ))}
                   </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Review</label>
                  <textarea 
                    rows={3} placeholder="What do you think about the platform?"
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-slate-900 bg-white resize-none"
                    value={reviewForm.text} onChange={e => setReviewForm({...reviewForm, text: e.target.value})}
                  />
                </div>
                <button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-bold py-3 rounded-xl shadow-lg hover:opacity-90 transition-all">
                  Post Review
                </button>
              </form>
            </div>

            {/* List */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-500 uppercase px-1">Past Reviews</h4>
              {myReviews.map((rev: any) => (
                <div key={rev.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                   <div className="flex items-center gap-1 mb-2">
                     {[...Array(5)].map((_, i) => (
                       <Star key={i} size={14} className={i < rev.rating ? "text-yellow-400" : "text-slate-200"} fill="currentColor" />
                     ))}
                     <span className="text-xs text-slate-400 ml-2">{formatDateDDMMYYYY(rev.createdAt)}</span>
                   </div>
                   <p className="text-slate-800 text-sm italic">"{rev.reviewText}"</p>
                </div>
              ))}
               {myReviews.length === 0 && <p className="text-center text-slate-400 italic py-4">No reviews yet.</p>}
            </div>
          </div>
        )}

      </div>

    </div>
  );
};

export default Support;
