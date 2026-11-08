import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import {
  auth,
  db,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  getManagerClaims,
  ManagerClaims
} from '../services/firebase';
import {
  BranchManager,
  getTodayStr,
  normalizeEmail
} from '../services/managerStore';

interface ManagerAuthContextType {
  currentUser: User | null;
  claims: ManagerClaims | null;
  loggedInManager: BranchManager | null;
  bizId: string;
  branchId: string;
  isAllBranches: boolean;
  allowedPages: string[];
  sessionLogId: string | null;
  loading: boolean;
  authError: string;
  clearAuthError: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const ManagerAuthContext = createContext<ManagerAuthContextType | undefined>(undefined);

export const ManagerAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bizId, setBizIdState] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<ManagerClaims | null>(null);
  const [loggedInManager, setLoggedInManager] = useState<BranchManager | null>(null);
  const [branchId, setBranchId] = useState<string>('');
  const [isAllBranches, setIsAllBranches] = useState<boolean>(false);
  const [allowedPages, setAllowedPages] = useState<string[]>(['dashboard']);
  const [sessionLogId, setSessionLogId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string>('');

  const clearAuthError = () => setAuthError('');

  const clearSession = () => {
    setCurrentUser(null);
    setClaims(null);
    setLoggedInManager(null);
    setBizIdState('');
    setBranchId('');
    setIsAllBranches(false);
    setAllowedPages(['dashboard']);
    setSessionLogId(null);
    localStorage.removeItem('manager_biz_id');
    localStorage.removeItem('manager_branch_id');
    localStorage.removeItem('manager_data');
    localStorage.removeItem('manager_session_log_id');
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (!user) {
        clearSession();
        setLoading(false);
        return;
      }

      try {
        const verifiedClaims = await getManagerClaims(user);
        if (
          verifiedClaims.role !== 'manager' ||
          !verifiedClaims.bizId ||
          !verifiedClaims.managerId ||
          !verifiedClaims.branchId
        ) {
          throw new Error('This Firebase account is not configured as an authorized manager. Ask the kitchen owner to configure your account.');
        }

        const authBizId = verifiedClaims.bizId;
        const authBranchId = verifiedClaims.branchId;
        const managerRef = doc(db, 'businesses', authBizId, 'managers', verifiedClaims.managerId);
        const managerSnap = await getDoc(managerRef);
        if (!managerSnap.exists()) {
          throw new Error('Your manager profile was not found. Ask the kitchen owner to save your account again.');
        }

        const data = managerSnap.data();
        const isInactive = data.status === 'Inactive' ||
          data.status === 'deactivated' ||
          data.status === 'disabled' ||
          data.active === false ||
          data.deleted === true ||
          data.isDeleted === true;
        if (isInactive) {
          throw new Error('This manager account has been deactivated by the kitchen owner.');
        }
        if (data.authUid !== user.uid || normalizeEmail(data.email || '') !== normalizeEmail(user.email || '')) {
          throw new Error('Your manager profile does not match this Firebase account. Ask the kitchen owner to update your manager credentials.');
        }
        if (data.branchId !== authBranchId) {
          throw new Error('Your branch assignment has changed. Sign out and sign in again to refresh your access.');
        }

        const pages = verifiedClaims.allowedPages?.length
          ? verifiedClaims.allowedPages
          : Array.isArray(data.allowedPages) && data.allowedPages.length
            ? data.allowedPages
            : ['dashboard'];
        const managerProfile: BranchManager = {
          id: verifiedClaims.managerId,
          name: data.name || 'Branch Manager',
          email: data.email || user.email || '',
          mobile: data.mobile || '',
          branchId: authBranchId,
          allowedPages: pages,
          status: data.status || 'Active',
          active: data.active !== false
        };

        setCurrentUser(user);
        setClaims(verifiedClaims);
        setBizIdState(authBizId);
        setBranchId(authBranchId);
        setIsAllBranches(verifiedClaims.allBranches === true || authBranchId === 'All');
        setAllowedPages(pages);
        setLoggedInManager(managerProfile);
        setAuthError('');

        let savedLogId = localStorage.getItem('manager_session_log_id');
        if (!savedLogId) {
          const now = new Date();
          savedLogId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          try {
            await setDoc(doc(db, 'businesses', authBizId, 'manager_logs', savedLogId), {
              id: savedLogId,
              managerId: verifiedClaims.managerId,
              managerName: managerProfile.name,
              managerEmail: managerProfile.email,
              branchId: authBranchId,
              branchName: authBranchId === 'All' ? 'All Branches' : 'Assigned Branch',
              date: getTodayStr(),
              loginTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              logoutTime: null,
              status: 'Active',
              createdAt: now.toISOString()
            });
            localStorage.setItem('manager_session_log_id', savedLogId);
          } catch (logError) {
            console.error('[ScaleKitchenManager] Could not record manager login:', logError);
          }
        }
        setSessionLogId(savedLogId);

      } catch (err: any) {
        console.error("[ScaleKitchenManager] Error validating manager session:", err);
        setAuthError(err instanceof Error ? err.message : 'Failed to verify manager session.');
        try {
          await signOut(auth);
        } catch (signOutError) {
          console.error('[ScaleKitchenManager] Could not clear invalid auth session:', signOutError);
        }
        clearSession();
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setAuthError('');
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error("A valid manager email address is required.");
    }
    if (!password) {
      throw new Error("Password is required.");
    }

    try {
      await signInWithEmailAndPassword(auth, cleanEmail, password);
    } catch (error: any) {
      if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].includes(error?.code)) {
        throw new Error('Invalid manager email or password. Check the credentials configured by your kitchen owner.');
      }
      if (error?.code === 'auth/too-many-requests') {
        throw new Error('Sign-in is temporarily blocked after too many attempts. Wait a few minutes and retry.');
      }
      if (error?.code === 'auth/network-request-failed') {
        throw new Error('Could not reach Firebase Authentication. Check your internet connection and retry.');
      }
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    if (bizId && sessionLogId) {
      try {
        const now = new Date();
        const logDocRef = doc(db, 'businesses', bizId, 'manager_logs', sessionLogId);
        await updateDoc(logDocRef, {
          logoutTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          status: 'Logged Out',
          updatedAt: now.toISOString()
        });
      } catch (err) {
        console.warn("[ScaleKitchenManager] Could not update manager logout timestamp:", err);
      }
    }

    try {
      await signOut(auth);
    } catch (err) {
      console.warn("[ScaleKitchenManager] Sign out error:", err);
    }

    clearSession();
  };

  return (
    <ManagerAuthContext.Provider
      value={{
        currentUser,
        claims,
        loggedInManager,
        bizId,
        branchId,
        isAllBranches,
        allowedPages,
        sessionLogId,
        loading,
        authError,
        clearAuthError,
        login,
        logout
      }}
    >
      {children}
    </ManagerAuthContext.Provider>
  );
};

export const useManagerAuth = (): ManagerAuthContextType => {
  const context = useContext(ManagerAuthContext);
  if (!context) {
    throw new Error('useManagerAuth must be used within a ManagerAuthProvider');
  }
  return context;
};
