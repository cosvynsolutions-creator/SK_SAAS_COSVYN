import React, { useState } from 'react';
import {
  Truck, CheckCircle, Clock, AlertTriangle, PackageCheck,
  MapPin, Phone, User, RefreshCw, Plus, Key, Lock, Eye, EyeOff,
  UserCheck, UserX, Mail, Shield, Check, X
} from 'lucide-react';
import { useManagerAuth } from '../contexts/ManagerAuthContext';
import { useStreamCollection, updateDocument } from '../services/dbService';
import { Customer, getTodayStr } from '../services/managerStore';
import { setDriverPasswordCallable } from '../services/firebase';

interface DriverStaff {
  id: string;
  name: string;
  email?: string;
  mobile?: string;
  role?: string;
  branchId?: string;
  vehicleNumber?: string;
  status?: string;
  active?: boolean;
}

export const DeliveriesView: React.FC = () => {
  const { bizId, branchId } = useManagerAuth();
  const todayStr = getTodayStr();

  const { data: staff } = useStreamCollection<DriverStaff>('staff');
  const { data: customers } = useStreamCollection<Customer>('customers');
  const { data: deliveryLogs } = useStreamCollection<any>('delivery_logs');

  const drivers = staff.filter(s => s.role === 'driver' || s.role === 'delivery');
  const todayLogs = deliveryLogs.filter(l => l.date === todayStr);

  const deliveredCount = todayLogs.filter(l => l.status === 'Delivered').length;
  const inTransitCount = todayLogs.filter(l => l.status === 'In-Transit' || l.status === 'Picked-Up').length;
  const pendingCount = Math.max(0, customers.length - deliveredCount - inTransitCount);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<DriverStaff | null>(null);

  // Form States
  const [driverName, setDriverName] = useState('');
  const [driverEmail, setDriverEmail] = useState('');
  const [driverPassword, setDriverPassword] = useState('');
  const [driverMobile, setDriverMobile] = useState('');
  const [driverVehicle, setDriverVehicle] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const resetForm = () => {
    setDriverName('');
    setDriverEmail('');
    setDriverPassword('');
    setDriverMobile('');
    setDriverVehicle('');
    setShowPassword(false);
    setActionError(null);
    setSelectedDriver(null);
  };

  // Add Delivery Partner Handler
  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizId) return;

    setActionError(null);
    const cleanEmail = driverEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setActionError('Valid email is required.');
      return;
    }

    if (!driverPassword || driverPassword.length < 6) {
      setActionError('Password must be at least 6 characters.');
      return;
    }

    setActionLoading(true);
    try {
      await setDriverPasswordCallable({
        bizId,
        email: cleanEmail,
        password: driverPassword,
        name: driverName.trim() || 'Delivery Partner',
        branchId: branchId === 'All' ? '' : branchId,
        mobile: driverMobile.trim(),
        vehicleNumber: driverVehicle.trim(),
        additionalData: {
          active: true,
          status: 'Offline',
          role: 'driver'
        }
      });

      setActionSuccess(`Delivery Partner "${driverName}" created successfully with email login!`);
      setIsAddModalOpen(false);
      resetForm();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to create delivery partner. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Reset Password Handler
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizId || !selectedDriver) return;

    setActionError(null);
    if (!driverPassword || driverPassword.length < 6) {
      setActionError('Password must be at least 6 characters.');
      return;
    }

    const emailToUse = (driverEmail.trim() || selectedDriver.email || '').toLowerCase();
    if (!emailToUse || !emailToUse.includes('@')) {
      setActionError('A valid email address is required to set credentials.');
      return;
    }

    setActionLoading(true);
    try {
      await setDriverPasswordCallable({
        bizId,
        staffId: selectedDriver.id,
        email: emailToUse,
        password: driverPassword,
        name: selectedDriver.name,
        branchId: selectedDriver.branchId || branchId,
        mobile: selectedDriver.mobile,
        vehicleNumber: selectedDriver.vehicleNumber
      });

      setActionSuccess(`Password reset successfully for "${selectedDriver.name}"!`);
      setIsPasswordModalOpen(false);
      resetForm();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to reset password.');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Activation / Deactivation
  const handleToggleActive = async (driver: DriverStaff) => {
    if (!bizId) return;
    const isCurrentlyActive = driver.active !== false && driver.status !== 'Inactive';
    const newActive = !isCurrentlyActive;
    const confirmMsg = newActive
      ? `Reactivate delivery partner account for ${driver.name}?`
      : `Deactivate delivery partner account for ${driver.name}? They will not be able to log in.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await updateDocument(bizId, 'staff', driver.id, {
        active: newActive,
        status: newActive ? 'Offline' : 'Inactive',
        updatedAt: new Date().toISOString()
      });

      setActionSuccess(
        newActive
          ? `Account activated for ${driver.name}.`
          : `Account deactivated for ${driver.name}.`
      );
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      alert(`Error updating driver status: ${err?.message || 'Permission denied'}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {actionSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="text-emerald-600 shrink-0" size={16} />
            <span className="font-semibold">{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-800">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="text-indigo-600" size={24} />
            <h1 className="text-xl font-bold text-slate-900 font-display">Fleet Deliveries & Route Dispatch</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time delivery status & driver accounts for Branch: <strong className="text-slate-800">{branchId}</strong>
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setIsAddModalOpen(true);
          }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
        >
          <Plus size={15} />
          <span>Add Delivery Partner</span>
        </button>
      </div>

      {/* Progress Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="glass-card bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Scheduled Today</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{customers.length}</div>
          <p className="text-[11px] text-slate-400 mt-1">Total active drops</p>
        </div>

        <div className="glass-card bg-emerald-50/70 p-5 rounded-2xl border border-emerald-200 shadow-xs">
          <span className="text-xs font-bold text-emerald-900">Delivered</span>
          <div className="text-2xl font-black text-emerald-900 mt-1">{deliveredCount}</div>
          <p className="text-[11px] text-emerald-700 mt-1">Successfully dropped</p>
        </div>

        <div className="glass-card bg-amber-50/70 p-5 rounded-2xl border border-amber-200 shadow-xs">
          <span className="text-xs font-bold text-amber-900">On The Road</span>
          <div className="text-2xl font-black text-amber-900 mt-1">{inTransitCount}</div>
          <p className="text-[11px] text-amber-700 mt-1">Out for delivery</p>
        </div>

        <div className="glass-card bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Pending Dispatch</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{pendingCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">Awaiting rider pickup</p>
        </div>
      </div>

      {/* Assigned Drivers Fleet */}
      <div className="glass-card bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Branch Delivery Drivers ({drivers.length})</h3>
            <p className="text-[11px] text-slate-400">Manage Email + Password credentials, status, and shifts</p>
          </div>
          <span className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg font-semibold">
            Partner App Ready
          </span>
        </div>

        {drivers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <Truck size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">No delivery drivers registered for this branch</p>
              <p className="text-xs text-slate-400 mt-0.5">Click "Add Delivery Partner" above to register riders with Email & Password.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {drivers.map(driver => {
              const isActive = driver.active !== false && driver.status !== 'Inactive';
              const isOnline = driver.status === 'Online';

              return (
                <div key={driver.id} className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shadow-xs ${
                      isActive ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {driver.name?.charAt(0) || 'D'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-xs text-slate-900">{driver.name}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          !isActive
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : isOnline
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {!isActive ? 'Deactivated' : isOnline ? 'Online / On Shift' : 'Offline'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 mt-1">
                        {driver.email && (
                          <span className="flex items-center gap-1 font-mono text-slate-700">
                            <Mail size={11} className="text-slate-400" />
                            {driver.email}
                          </span>
                        )}
                        {driver.mobile && (
                          <span className="flex items-center gap-1 font-mono">
                            <Phone size={11} className="text-slate-400" />
                            {driver.mobile}
                          </span>
                        )}
                        <span>Vehicle: <strong>{driver.vehicleNumber || 'Bike / Standard'}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Reset Password Button */}
                    <button
                      onClick={() => {
                        setSelectedDriver(driver);
                        setDriverEmail(driver.email || '');
                        setDriverPassword('');
                        setActionError(null);
                        setIsPasswordModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200"
                      title="Set or Reset Rider Password"
                    >
                      <Key size={13} className="text-slate-500" />
                      <span>Set Password</span>
                    </button>

                    {/* Toggle Active / Deactivate */}
                    <button
                      onClick={() => handleToggleActive(driver)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                        isActive
                          ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {isActive ? (
                        <>
                          <UserX size={13} />
                          <span>Deactivate</span>
                        </>
                      ) : (
                        <>
                          <UserCheck size={13} />
                          <span>Reactivate</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: ADD DELIVERY PARTNER */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 text-left">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Truck size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 font-display">Add Delivery Partner</h3>
                  <p className="text-[11px] text-slate-500">Configure rider profile & Email login</p>
                </div>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X size={18} />
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2">
                <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-500" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleAddDriver} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Rider Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Login Email Address *</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. ramesh.delivery@kitchen.com"
                    value={driverEmail}
                    onChange={(e) => setDriverEmail(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Initial Password *</label>
                  <span className="text-[10px] text-slate-400">Min 6 characters</span>
                </div>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={driverPassword}
                    onChange={(e) => setDriverPassword(e.target.value)}
                    className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Mobile (Optional)</label>
                  <input
                    type="tel"
                    placeholder="10-digit phone"
                    value={driverMobile}
                    onChange={(e) => setDriverMobile(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Vehicle / Bike No.</label>
                  <input
                    type="text"
                    placeholder="e.g. KA-01-AB-1234"
                    value={driverVehicle}
                    onChange={(e) => setDriverVehicle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600">
                <span>Assigned Branch: <strong>{branchId === 'All' ? 'All Organization Branches' : branchId}</strong></span>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {actionLoading ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <span>Register Partner</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RESET PASSWORD */}
      {isPasswordModalOpen && selectedDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 text-left">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Key size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 font-display">Set Driver Password</h3>
                  <p className="text-[11px] text-slate-500">{selectedDriver.name}</p>
                </div>
              </div>
              <button onClick={() => setIsPasswordModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X size={18} />
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2">
                <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-500" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Driver Email Address *</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="rider@kitchen.com"
                    value={driverEmail}
                    onChange={(e) => setDriverEmail(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">New Password *</label>
                  <span className="text-[10px] text-slate-400">Min 6 characters</span>
                </div>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter new password"
                    value={driverPassword}
                    onChange={(e) => setDriverPassword(e.target.value)}
                    className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600">
                <span>The driver will use this email and password to log in to the Delivery Partner App.</span>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {actionLoading ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <span>Update Password</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
