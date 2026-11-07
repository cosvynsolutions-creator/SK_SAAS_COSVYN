import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import {
  auth,
  db,
  managerLoginCallable,
  signInWithCustomToken,
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
  setBizId: (bizId: string) => void;
  clearAuthError: () => void;
  login: (email: string, password: string, targetBizId: string) => Promise<BranchManager>;
  logout: () => Promise<void>;
}

const ManagerAuthContext = createContext<ManagerAuthContextType | undefined>(undefined);

export const ManagerAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Read initial biz from URL query or hash params
  const getInitialBiz = (): string => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const urlBiz = searchParams.get('biz');
      if (urlBiz) return urlBiz;

      const hashPart = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
      const hashParams = new URLSearchParams(hashPart);
      const hashBiz = hashParams.get('biz');
      if (hashBiz) return hashBiz;

      return localStorage.getItem('manager_biz_id') || '';
    } catch {
      return '';
    }
  };

  const [bizId, setBizIdState] = useState<string>(getInitialBiz());
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

  const setBizId = (newBizId: string) => {
    const trimmed = newBizId.trim();
    setBizIdState(trimmed);
    if (trimmed) {
      localStorage.setItem('manager_biz_id', trimmed);
    } else {
      localStorage.removeItem('manager_biz_id');
    }
  };

  const clearSession = () => {
    setCurrentUser(null);
    setClaims(null);
    setLoggedInManager(null);
    setBranchId('');
    setIsAllBranches(false);
    setAllowedPages(['dashboard']);
    setSessionLogId(null);
    localStorage.removeItem('manager_data');
    localStorage.removeItem('manager_branch_id');
    localStorage.removeItem('manager_session_log_id');
  };

  // Secure Auth listener: Authoritative verification on the dedicated ScaleKitchenManager Firebase app
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        clearSession();
        setLoading(false);
        return;
      }

      try {
        // Step 1: Force refresh token and retrieve cryptographically verified claims
        const verifiedClaims = await getManagerClaims(user);

        // Step 2: Strict authorization validation
        if (
          !verifiedClaims ||
          verifiedClaims.role !== 'manager' ||
          !verifiedClaims.bizId ||
          !verifiedClaims.managerId ||
          !verifiedClaims.branchId
        ) {
          console.warn("[ScaleKitchenManager] Unauthorized token claims:", verifiedClaims);
          setAuthError("Unauthorized session: Invalid or expired manager credentials.");
          await signOut(auth);
          clearSession();
          setLoading(false);
          return;
        }

        // Step 3: Establish authorized context exclusively from verified claims
        const authBizId = verifiedClaims.bizId;
        const authBranchId = verifiedClaims.branchId;
        const allBranchesFlag = verifiedClaims.allBranches || authBranchId === 'All';

        setCurrentUser(user);
        setClaims(verifiedClaims);
        setBizIdState(authBizId);
        setBranchId(authBranchId);
        setIsAllBranches(allBranchesFlag);

        // Step 4: Fetch authoritative Manager Profile from Firestore
        let managerProfile: BranchManager | null = null;
        try {
          const mgrDocRef = doc(db, 'businesses', authBizId, 'managers', verifiedClaims.managerId);
          const mgrSnap = await getDoc(mgrDocRef);
          if (mgrSnap.exists()) {
            const data = mgrSnap.data();
            
            // Check deactivation status on session restore
            const isInactive = 
              data.status === 'Inactive' || 
              data.status === 'deactivated' || 
              data.status === 'disabled' || 
              data.active === false || 
              data.deleted === true;

            if (isInactive) {
              setAuthError("This manager account has been deactivated by the kitchen owner.");
              await signOut(auth);
              clearSession();
              setLoading(false);
              return;
            }

            managerProfile = {
              id: mgrSnap.id,
              name: data.name || 'Branch Manager',
              email: data.email || user.email || '',
              mobile: data.mobile || '',
              branchId: authBranchId, // Enforced by verified claims
              allowedPages: Array.isArray(data.allowedPages) && data.allowedPages.length > 0 
                ? data.allowedPages 
                : ['dashboard'],
              status: data.status || 'Active',
              active: data.active !== false
            };
          }
        } catch (fetchErr) {
          console.warn("[ScaleKitchenManager] Authoritative doc fetch warning, validating cached profile:", fetchErr);
        }

        // Fallback: If network issue on profile fetch, validate cached profile against verified claims
        if (!managerProfile) {
          const cachedRaw = localStorage.getItem('manager_data');
          if (cachedRaw) {
            try {
              const cached = JSON.parse(cachedRaw);
              if (cached.id === verifiedClaims.managerId) {
                managerProfile = {
                  ...cached,
                  branchId: authBranchId, // Enforced by claims
                  id: verifiedClaims.managerId
                };
              }
            } catch {}
          }
        }

        if (managerProfile) {
          setLoggedInManager(managerProfile);
          if (managerProfile.allowedPages && managerProfile.allowedPages.length > 0) {
            setAllowedPages(managerProfile.allowedPages);
          }
        } else {
          // Fallback minimal manager profile
          setLoggedInManager({
            id: verifiedClaims.managerId,
            name: 'Branch Manager',
            email: user.email || '',
            mobile: '',
            branchId: authBranchId,
            allowedPages: ['dashboard']
          });
        }

        const savedLogId = localStorage.getItem('manager_session_log_id');
        if (savedLogId) setSessionLogId(savedLogId);

      } catch (err: any) {
        console.error("[ScaleKitchenManager] Error validating manager session:", err);
        setAuthError("Failed to verify manager session.");
        await signOut(auth);
        clearSession();
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string, targetBizId: string): Promise<BranchManager> => {
    setAuthError('');
    const cleanEmail = normalizeEmail(email);
    const cleanBizId = targetBizId.trim();

    if (!cleanBizId) {
      throw new Error("A valid Kitchen / Business ID is required.");
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error("A valid manager email address is required.");
    }
    if (!password) {
      throw new Error("Password is required.");
    }

    // Invoke cloud function with strict business resolution and deactivation check
    const result = await managerLoginCallable({
      email: cleanEmail,
      password,
      bizId: cleanBizId
    });

    if (!result?.data?.token) {
      throw new Error("No authorization token received from server.");
    }

    // Authenticate with custom token on the dedicated named app instance
    const cred = await signInWithCustomToken(auth, result.data.token);
    const verifiedClaims = await getManagerClaims(cred.user);

    if (!verifiedClaims || verifiedClaims.role !== 'manager' || !verifiedClaims.bizId) {
      await signOut(auth);
      throw new Error("Unauthorized token claims received. Access denied.");
    }

    const resolvedBranch = verifiedClaims.branchId || result.data.manager?.branchId || 'All';
    const resolvedBiz = verifiedClaims.bizId;
    const managerId = verifiedClaims.managerId || result.data.manager?.id;
    const pages = (result.data.manager?.allowedPages && result.data.manager.allowedPages.length > 0)
      ? result.data.manager.allowedPages
      : ['dashboard'];

    // Create session audit log in Firestore
    const todayStr = getTodayStr();
    const now = new Date();
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const logData = {
      id: logId,
      managerId,
      managerName: result.data.manager?.name || 'Branch Manager',
      managerEmail: cleanEmail,
      branchId: resolvedBranch,
      branchName: resolvedBranch === 'All' ? 'All Branches' : 'Main Branch',
      date: todayStr,
      loginTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      logoutTime: null,
      status: 'Active',
      createdAt: now.toISOString()
    };

    try {
      await setDoc(doc(db, 'businesses', resolvedBiz, 'manager_logs', logId), logData);
      setSessionLogId(logId);
      localStorage.setItem('manager_session_log_id', logId);
    } catch (logErr: any) {
      console.warn("[ScaleKitchenManager] Manager session logging warning:", logErr?.message);
    }

    const managerObj: BranchManager = {
      id: managerId,
      name: result.data.manager?.name || 'Branch Manager',
      email: cleanEmail,
      branchId: resolvedBranch,
      allowedPages: pages,
      mobile: ''
    };

    setBizIdState(resolvedBiz);
    setBranchId(resolvedBranch);
    setIsAllBranches(resolvedBranch === 'All');
    setAllowedPages(pages);
    setLoggedInManager(managerObj);
    setClaims(verifiedClaims);

    localStorage.setItem('manager_biz_id', resolvedBiz);
    localStorage.setItem('manager_data', JSON.stringify(managerObj));
    localStorage.setItem('manager_branch_id', resolvedBranch);

    return managerObj;
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
        setBizId,
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
