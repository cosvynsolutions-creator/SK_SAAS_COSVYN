
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  setPersistence,
  inMemoryPersistence
} from 'firebase/auth';
import { auth, googleProvider, firebaseConfig } from '../services/firebase';

interface AuthContextType {
  currentUser: User | null;
  businessData?: any;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  signupWithEmail: (email: string, pass: string) => Promise<User>;
  loginWithEmail: (email: string, pass: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Pre-load from localStorage session if available for immediate UI responsiveness
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem('scalekitchen_auth_session');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.uid) {
          return {
            uid: parsed.uid,
            email: parsed.email || '',
            displayName: parsed.displayName || parsed.email?.split('@')[0] || 'User',
            getIdToken: async () => parsed.idToken || '',
            reload: async () => {}
          } as unknown as User;
        }
      }
    } catch (e) {
      console.warn("Session restore warning:", e);
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  // Helper to persist user session
  const persistSession = (user: { uid: string; email?: string | null; displayName?: string | null; idToken?: string }) => {
    try {
      localStorage.setItem('scalekitchen_auth_session', JSON.stringify({
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        idToken: user.idToken || '',
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn("Failed saving auth session:", e);
    }
  };

  const loginWithGoogle = async () => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred.user) {
        persistSession(cred.user);
        setCurrentUser(cred.user);
      }
    } catch (error: any) {
      console.error("Google Login failed", error);
      if (error?.code === 'auth/network-request-failed' || error?.code === 'auth/popup-blocked') {
        const customErr: any = new Error("Google Sign-In is unavailable inside embedded preview windows. Please sign in with email and password.");
        customErr.code = 'auth/popup-restricted';
        throw customErr;
      }
      throw error;
    }
  };

  const signupWithEmail = async (email: string, pass: string): Promise<User> => {
    const cleanEmail = email.trim();
    
    // First attempt: Firebase SDK createUserWithEmailAndPassword
    try {
      const result = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      persistSession(result.user);
      setCurrentUser(result.user);
      return result.user;
    } catch (error: any) {
      console.warn("Standard signupWithEmail encountered error:", error?.code, error?.message);

      // Fallback via Google Identity REST API if SDK network or iframe storage failed
      if (error?.code === 'auth/network-request-failed' || error?.message?.includes('network-request-failed') || error?.code === 'auth/internal-error') {
        try {
          const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail, password: pass, returnSecureToken: true })
          });
          const data = await res.json();
          if (data.error) {
            const msg = data.error.message || '';
            if (msg.includes('EMAIL_EXISTS')) {
              const customErr: any = new Error("This email is already registered. Please log in instead.");
              customErr.code = 'auth/email-already-in-use';
              throw customErr;
            } else if (msg.includes('WEAK_PASSWORD')) {
              const customErr: any = new Error("Password must be at least 6 characters.");
              customErr.code = 'auth/weak-password';
              throw customErr;
            } else if (msg.includes('INVALID_EMAIL')) {
              const customErr: any = new Error("Please enter a valid email address.");
              customErr.code = 'auth/invalid-email';
              throw customErr;
            } else {
              const customErr: any = new Error(data.error.message || "Failed to create account.");
              customErr.code = 'auth/signup-failed';
              throw customErr;
            }
          } else if (data.idToken && data.localId) {
            persistSession({
              uid: data.localId,
              email: data.email || cleanEmail,
              displayName: cleanEmail.split('@')[0],
              idToken: data.idToken
            });

            try {
              const retryRes = await signInWithEmailAndPassword(auth, cleanEmail, pass);
              persistSession(retryRes.user);
              setCurrentUser(retryRes.user);
              return retryRes.user;
            } catch {
              const syntheticUser: any = {
                uid: data.localId,
                email: data.email || cleanEmail,
                displayName: cleanEmail.split('@')[0],
                getIdToken: async () => data.idToken,
                reload: async () => {}
              };
              setCurrentUser(syntheticUser);
              return syntheticUser;
            }
          }
        } catch (restErr: any) {
          if (restErr.code) throw restErr;
          console.error("Direct REST signup error:", restErr);
        }
      }

      console.error("Signup failed", error);
      throw error;
    }
  };

  const loginWithEmail = async (email: string, pass: string): Promise<User> => {
    const cleanEmail = email.trim();
    try {
      const result = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      persistSession(result.user);
      setCurrentUser(result.user);
      return result.user;
    } catch (error: any) {
      console.warn("Standard loginWithEmail encountered error:", error?.code, error?.message);

      // Fallback via Google Identity REST API if SDK network or iframe storage failed
      if (error?.code === 'auth/network-request-failed' || error?.message?.includes('network-request-failed') || error?.code === 'auth/internal-error') {
        try {
          const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail, password: pass, returnSecureToken: true })
          });
          const data = await res.json();
          if (data.error) {
            const msg = data.error.message || '';
            if (msg.includes('INVALID_LOGIN_CREDENTIALS') || msg.includes('EMAIL_NOT_FOUND') || msg.includes('INVALID_PASSWORD')) {
              const customErr: any = new Error("Invalid email or password. Please verify your credentials or create a new account.");
              customErr.code = 'auth/invalid-credential';
              throw customErr;
            } else if (msg.includes('USER_DISABLED')) {
              const customErr: any = new Error("This account has been disabled.");
              customErr.code = 'auth/user-disabled';
              throw customErr;
            } else if (msg.includes('TOO_MANY_ATTEMPTS_TRY_LATER')) {
              const customErr: any = new Error("Too many failed login attempts. Please try again in a few minutes.");
              customErr.code = 'auth/too-many-requests';
              throw customErr;
            } else {
              const customErr: any = new Error(data.error.message || "Login authentication failed.");
              customErr.code = 'auth/invalid-credential';
              throw customErr;
            }
          } else if (data.idToken && data.localId) {
            persistSession({
              uid: data.localId,
              email: data.email || cleanEmail,
              displayName: cleanEmail.split('@')[0],
              idToken: data.idToken
            });

            try {
              const retryRes = await signInWithEmailAndPassword(auth, cleanEmail, pass);
              persistSession(retryRes.user);
              setCurrentUser(retryRes.user);
              return retryRes.user;
            } catch {
              const syntheticUser: any = {
                uid: data.localId,
                email: data.email || cleanEmail,
                displayName: cleanEmail.split('@')[0],
                getIdToken: async () => data.idToken,
                reload: async () => {}
              };
              setCurrentUser(syntheticUser);
              return syntheticUser;
            }
          }
        } catch (restErr: any) {
          if (restErr.code) throw restErr;
          console.error("Direct REST login check error:", restErr);
        }
      }

      console.error("Login failed", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem('scalekitchen_auth_session');
      await signOut(auth);
    } catch (e) {
      console.warn("Logout error:", e);
    } finally {
      setCurrentUser(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        persistSession(user);
        setCurrentUser(user);
      } else {
        // If auth says null, check if we have a persisted synthetic session
        try {
          const cached = localStorage.getItem('scalekitchen_auth_session');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.uid) {
              setCurrentUser({
                uid: parsed.uid,
                email: parsed.email || '',
                displayName: parsed.displayName || parsed.email?.split('@')[0] || 'User',
                getIdToken: async () => parsed.idToken || '',
                reload: async () => {}
              } as unknown as User);
            }
          }
        } catch (e) {}
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    loading,
    loginWithGoogle,
    signupWithEmail,
    loginWithEmail,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
