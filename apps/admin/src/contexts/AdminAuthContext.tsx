import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  auth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  getIdTokenResult,
  googleProvider,
  signInWithPopup,
  verifyAdminAuthCallable,
  User,
  IdTokenResult
} from '../services/firebase';
import { isAdminEmail } from '../services/adminStore';

interface AdminAuthContextType {
  currentUser: User | null;
  isAdmin: boolean;
  claims: Record<string, any> | null;
  loading: boolean;
  authError: string | null;
  loginWithEmail: (email: string, pass: string) => Promise<User>;
  loginWithGoogle: () => Promise<User>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [claims, setClaims] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (!user) {
        setCurrentUser(null);
        setIsAdmin(false);
        setClaims(null);
        setLoading(false);
        return;
      }

      try {
        // 1. Inspect cryptographically signed ID token claims
        let tokenResult: IdTokenResult = await getIdTokenResult(user, true);
        let userClaims = tokenResult.claims;

        let authorized = userClaims.admin === true;

        // 2. If token does not yet contain { admin: true }, invoke server-authoritative verification callable
        if (!authorized) {
          try {
            const verificationResult = await verifyAdminAuthCallable();
            if (verificationResult.data && verificationResult.data.authorized) {
              // Force token refresh to pick up server-minted custom claim
              tokenResult = await getIdTokenResult(user, true);
              userClaims = tokenResult.claims;
              authorized = true;
            }
          } catch (callErr: any) {
            console.warn("[ScaleKitchenAdmin] Server admin verification check failed:", callErr.message);
          }
        }

        // 3. Fallback check on email verification if in development/migration transition
        if (!authorized && user.email && isAdminEmail(user.email)) {
          authorized = true;
        }

        if (!authorized) {
          console.warn("[ScaleKitchenAdmin] User is not authorized as Super Admin. Terminating session.");
          await signOut(auth);
          setCurrentUser(null);
          setIsAdmin(false);
          setClaims(null);
          setAuthError("Access denied: You do not have Super Admin privileges on this platform.");
          setLoading(false);
          return;
        }

        // Verified Super Admin
        setCurrentUser(user);
        setIsAdmin(true);
        setClaims(userClaims);
        setAuthError(null);
      } catch (err: any) {
        console.error("[ScaleKitchenAdmin] Session verification exception:", err);
        await signOut(auth);
        setCurrentUser(null);
        setIsAdmin(false);
        setClaims(null);
        setAuthError("Authentication failure: Could not verify admin authorization.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, pass: string): Promise<User> => {
    setLoading(true);
    setAuthError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
      const user = cred.user;

      // Verify claims or trigger server verification
      let tokenResult = await getIdTokenResult(user, true);
      let isSuperAdmin = tokenResult.claims.admin === true;

      if (!isSuperAdmin) {
        try {
          const verification = await verifyAdminAuthCallable();
          if (verification.data?.authorized) {
            tokenResult = await getIdTokenResult(user, true);
            isSuperAdmin = true;
          }
        } catch {
          // Check authorized email list
          if (user.email && isAdminEmail(user.email)) {
            isSuperAdmin = true;
          }
        }
      }

      if (!isSuperAdmin) {
        await signOut(auth);
        throw new Error("Access Denied: Account lacks Super Admin privileges.");
      }

      setCurrentUser(user);
      setIsAdmin(true);
      setClaims(tokenResult.claims);
      return user;
    } catch (err: any) {
      setAuthError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (): Promise<User> => {
    setLoading(true);
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const user = cred.user;

      let tokenResult = await getIdTokenResult(user, true);
      let isSuperAdmin = tokenResult.claims.admin === true;

      if (!isSuperAdmin) {
        try {
          const verification = await verifyAdminAuthCallable();
          if (verification.data?.authorized) {
            tokenResult = await getIdTokenResult(user, true);
            isSuperAdmin = true;
          }
        } catch {
          if (user.email && isAdminEmail(user.email)) {
            isSuperAdmin = true;
          }
        }
      }

      if (!isSuperAdmin) {
        await signOut(auth);
        throw new Error("Access Denied: Account lacks Super Admin privileges.");
      }

      setCurrentUser(user);
      setIsAdmin(true);
      setClaims(tokenResult.claims);
      return user;
    } catch (err: any) {
      setAuthError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setCurrentUser(null);
      setIsAdmin(false);
      setClaims(null);
      setAuthError(null);
    } finally {
      setLoading(false);
    }
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  return (
    <AdminAuthContext.Provider
      value={{
        currentUser,
        isAdmin,
        claims,
        loading,
        authError,
        loginWithEmail,
        loginWithGoogle,
        logout,
        clearAuthError,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};
