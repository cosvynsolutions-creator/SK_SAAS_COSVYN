import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, CheckCircle, ArrowRight, Loader2, Building, Mail, Lock, Phone, ArrowLeft, AlertCircle, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { checkFreeTrialEligibility } from '../services/dbService';

const Signup = () => {
  const { signupWithEmail } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasPendingSubscription, setHasPendingSubscription] = useState(false);

  useEffect(() => {
    const pending = localStorage.getItem('pending_subscription');
    if (pending) {
      setHasPendingSubscription(true);
    }
  }, []);

  const [formData, setFormData] = useState({
    ownerName: '',
    businessName: '',
    email: '',
    mobile: '',
    password: '',
    confirmPassword: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      // 1. Optional trial check (non-blocking)
      try {
        const trialCheck = await checkFreeTrialEligibility(formData.email.trim(), formData.mobile.trim());
        if (!trialCheck.eligible) {
          sessionStorage.setItem('trial_already_claimed', 'true');
        }
      } catch (tErr) {
        console.warn("Trial eligibility check note:", tErr);
      }

      // 2. Create Authentication User
      const user = await signupWithEmail(formData.email.trim(), formData.password);

      // 3. Create Initial Profile in Firestore
      const initProfile = {
        ownerName: formData.ownerName.trim(),
        email: formData.email.trim(),
        mobile: formData.mobile.trim(),
        businessName: formData.businessName.trim(),
        state: '',
        city: '',
        country: 'India',
        description: '',
        category: 'Tiffin Service',
        isProfileComplete: Boolean(formData.ownerName.trim() && formData.businessName.trim() && formData.mobile.trim()),
        planName: 'None',
        planExpiryDate: new Date().toISOString().split('T')[0],
        planStatus: 'Inactive',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      try {
        await setDoc(doc(db, 'businesses', user.uid), initProfile, { merge: true });
      } catch (dbErr) {
        console.warn("Initial profile write note:", dbErr);
      }

      navigate('/onboarding');
    } catch (err: any) {
      console.error("Signup Error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError("This email is already registered. Please log in instead.");
      } else if (err.code === 'auth/invalid-email') {
        setError("Invalid email address format.");
      } else if (err.code === 'auth/weak-password') {
        setError("Password should be at least 6 characters.");
      } else if (err.code === 'auth/network-request-failed') {
        setError("Network connection issue communicating with auth service. Please check your internet connection and retry.");
      } else {
        const cleanMsg = (err.message || "Failed to create account. Please check your details and try again.")
          .replace(/^Firebase:\s*/i, '')
          .replace(/\(auth\/[^)]+\)/g, '')
          .trim();
        setError(cleanMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left: Branding (Hidden on Mobile) */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary-600/30 rounded-full blur-[100px]" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-violet-500 rounded-xl flex items-center justify-center shadow-lg">
              <Zap size={24} fill="currentColor" />
            </div>
            <span className="text-2xl font-bold tracking-tight">ScaleKitchen</span>
          </div>
          <h1 className="text-5xl font-bold leading-tight mb-6">Scale your kitchen.<br/>Simplify your life.</h1>
          <p className="text-slate-400 text-lg max-w-md">Join thousands of tiffin services and cloud kitchens managing their entire business on ScaleKitchen.</p>
        </div>

        <div className="space-y-4 relative z-10">
          {[
            'Automated Customer Renewals', 
            'Delivery Route Optimization', 
            'Expense & Profit Tracking',
            'Dedicated Business Profile'
          ].map((feat, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center">
                <CheckCircle size={14} />
              </div>
              <span className="font-medium">{feat}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Signup Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 overflow-y-auto relative">
        
        <Link to="/" className="absolute top-6 left-6 lg:left-12 flex items-center gap-2 text-slate-400 hover:text-slate-700 transition-colors text-sm font-medium group z-20">
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Back
        </Link>

        <div className="w-full max-w-md space-y-8 mt-8 lg:mt-0">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-slate-900">Create your account</h2>
            <p className="text-primary-600 font-bold mt-2 text-lg">Start your free trial and manage your business effectively.</p>
          </div>

          {hasPendingSubscription && (
            <div className="bg-green-50 text-green-700 p-4 rounded-lg text-sm font-medium border border-green-200 flex flex-col gap-2 shadow-sm animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <CheckCircle size={20} className="shrink-0 text-green-600" />
                <span className="font-bold text-lg">Payment Received!</span>
              </div>
              <p className="text-slate-600 ml-7">Create your account below to instantly activate your subscription.</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100 flex items-start gap-3 shadow-sm animate-in shake duration-300">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div className="flex-1">
                {error}
                {error.includes("already registered") && (
                   <Link to="/login" className="block mt-1 font-bold underline hover:text-red-800">Login Now &rarr;</Link>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="relative">
                  <User className="absolute left-3 top-3.5 text-slate-400" size={18} />
                  <input required name="ownerName" type="text" placeholder="Owner / Full Name" className="w-full pl-10 p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-slate-900" onChange={handleChange} />
                </div>
                <div className="relative">
                  <Building className="absolute left-3 top-3.5 text-slate-400" size={18} />
                  <input required name="businessName" type="text" placeholder="Business Name" className="w-full pl-10 p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-slate-900" onChange={handleChange} />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 text-slate-400" size={18} />
                  <input required name="email" type="email" placeholder="Email Address" className="w-full pl-10 p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-slate-900" onChange={handleChange} />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-3.5 text-slate-400" size={18} />
                  <input required name="mobile" type="tel" placeholder="Mobile Number" className="w-full pl-10 p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-slate-900" onChange={handleChange} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 text-slate-400" size={18} />
                    <input required name="password" type="password" placeholder="Password" className="w-full pl-10 p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-slate-900" onChange={handleChange} />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 text-slate-400" size={18} />
                    <input required name="confirmPassword" type="password" placeholder="Confirm" className="w-full pl-10 p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-slate-900" onChange={handleChange} />
                  </div>
                </div>
              </div>
            </div>

            <button 
              disabled={loading}
              type="submit" 
              className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-70"
            >
              {loading ? <Loader2 className="animate-spin" /> : <>Create Account <ArrowRight size={20} /></>}
            </button>

            <p className="text-center text-sm text-slate-500">
              Already have an account? <Link to="/login" className="text-primary-600 font-bold hover:underline">Log in</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Signup;