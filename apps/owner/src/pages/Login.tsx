
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, CheckCircle, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { isAdminEmail } from '../services/adminStore';
import { recordOwnerDailyLogin } from '../services/dbService';

const Login = () => {
  const { loginWithEmail, currentUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasPendingSubscription, setHasPendingSubscription] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
    const pending = localStorage.getItem('pending_subscription');
    if (pending) {
      setHasPendingSubscription(true);
    }
  }, []);

  const handleAuthSuccess = async (user: any) => {
    if (isAdminEmail(user.email)) {
      setIsAdminUser(true);
      return;
    }

    // Record owner's daily login activity in Firestore
    recordOwnerDailyLogin(user.uid);

    try {
      const docRef = doc(db, 'businesses', user.uid);
      let docSnap = null;
      
      // Retry loop to handle Firebase Auth -> Firestore propagation delay
      for (let i = 0; i < 3; i++) {
        try {
          docSnap = await getDoc(docRef);
          break; 
        } catch (e: any) {
          if (i === 2) throw e; 
          await new Promise(r => setTimeout(r, 800)); 
        }
      }

      if (docSnap && docSnap.exists()) {
        const data = docSnap.data();
        if (data.planStatus === 'Active') {
          navigate('/app/dashboard');
        } else {
          navigate('/onboarding');
        }
      } else {
        navigate('/onboarding');
      }
    } catch (e: any) {
      console.warn("Routing fallback after profile fetch error:", e.message);
      // Fallback to dashboard; persistent listeners will eventually sync data
      navigate('/app/dashboard'); 
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await loginWithEmail(email.trim(), password);
      await handleAuthSuccess(user);
    } catch (err: any) {
      console.error("Login Error:", err);
      const errorCode = err.code;
      const errorMessage = (err.message || "").toLowerCase();

      if (
        errorCode === 'auth/invalid-credential' || 
        errorCode === 'auth/user-not-found' || 
        errorCode === 'auth/wrong-password' ||
        errorMessage.includes('invalid-credential') ||
        errorMessage.includes('user-not-found')
      ) {
         setError("Invalid email or password. If you don't have an account yet, please create one on the signup page.");
      } else if (errorCode === 'auth/too-many-requests') {
         setError("Account temporarily locked due to many failed attempts. Try again later.");
      } else if (errorCode === 'auth/network-request-failed') {
         setError("Network connection issue communicating with authentication servers. Please retry in a moment.");
      } else {
         const cleanMsg = (err.message || "Login failed. Please verify your details.")
           .replace(/^Firebase:\s*/i, '')
           .replace(/\(auth\/[^)]+\)/g, '')
           .trim();
         setError(cleanMsg);
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      handleAuthSuccess(currentUser);
    }
  }, [currentUser]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary-600/20 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[100px]" />

      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-4xl w-full grid md:grid-cols-2 relative z-10">
        
        <div className="hidden md:flex bg-gradient-to-br from-slate-900 to-slate-800 p-12 text-white flex-col justify-between relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
          
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-violet-500 rounded-xl flex items-center justify-center shadow-lg">
                <Zap size={24} fill="currentColor" />
              </div>
              <span className="text-2xl font-bold tracking-tight">ScaleKitchen</span>
            </div>
            <h2 className="text-4xl font-bold mb-6 leading-tight">Scale your meal prep business with ease.</h2>
            <p className="text-slate-400 text-lg">One unified platform for subscriptions, deliveries, and billing.</p>
          </div>

          <div className="space-y-4 mt-8">
            {['Billing Automation', 'Route Planning', 'Data Analytics'].map((feat, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center">
                  <CheckCircle size={14} />
                </div>
                <span className="font-medium">{feat}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 md:p-12 flex flex-col justify-center items-center relative w-full">
          
          <Link to="/" className="absolute top-4 left-4 md:top-6 md:left-6 flex items-center gap-2 text-slate-400 hover:text-slate-700 transition-colors text-sm font-medium group">
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Back
          </Link>

          <div className="w-full max-w-sm mt-8 md:mt-0">
            <div className="text-center mb-6 md:mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Welcome Back</h3>
              <p className="text-slate-500">Enter details to manage your kitchen.</p>
            </div>

            {hasPendingSubscription && (
              <div className="bg-green-50 text-green-700 p-4 rounded-lg text-sm font-medium border border-green-200 mb-6 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2">
                  <CheckCircle size={20} className="shrink-0 text-green-600" />
                  <span className="font-bold text-lg">Payment Verified!</span>
                </div>
                <p className="text-slate-600 ml-7">Log in to your account to start using the app.</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm font-medium border border-red-100 mb-6 flex items-start gap-3 shadow-sm">
                <AlertCircle size={18} className="shrink-0 mt-0.5" /> 
                <span className="leading-snug">{error}</span>
              </div>
            )}

            {isAdminUser && (
              <div className="mb-6 rounded-xl border border-primary-200 bg-primary-50 p-4 text-center text-sm text-slate-700">
                This account uses the admin app.{' '}
                <a className="font-bold text-primary-700 hover:underline" href={import.meta.env.VITE_ADMIN_APP_URL}>
                  Continue to the admin app
                </a>
              </div>
            )}

            <form onSubmit={handleEmailLogin} className="space-y-4 mb-6">
              <div>
                <input 
                  type="email" 
                  placeholder="Email Address" 
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all text-slate-900"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <input 
                  type="password" 
                  placeholder="Password" 
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all text-slate-900"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center disabled:opacity-70"
              >
                {loading ? <Loader2 className="animate-spin" /> : "Sign In"}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-slate-500">
              New here? <Link to="/signup" className="text-primary-600 font-bold hover:underline">Create an account</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
