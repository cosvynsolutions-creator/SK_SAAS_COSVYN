import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Compass, MapPin, Navigation, Phone, ExternalLink, Check, 
  MessageSquare, RefreshCw, Clock, ArrowRight, Share2, AlertCircle, 
  Sparkles, CheckCircle2, ChevronRight, Layers, Edit3, Save, Star
} from 'lucide-react';
import { 
  optimizeRouteOrder, formatWhatsAppOptimizedRoute, 
  OptimizedRouteResult, HubLocation, extractCoordinates 
} from '../services/routeOptimizer';
import { getPlanDeliveryDayNumber, getCustomerScheduledPlansForSession, formatDateDDMMYYYY } from '../services/store';

interface RouteOptimizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliveryBoy: any;
  customersToday: any[];
  mealTime: 'Breakfast' | 'Lunch' | 'Dinner';
  branch: any;
  dateStr?: string;
  onApplyNewOrder: (orderedCustomerIds: string[]) => Promise<void>;
  onUpdateHubLocation?: (branchId: string, hubAddress: string, hubLocationLink: string) => Promise<void>;
}

export const RouteOptimizerModal: React.FC<RouteOptimizerModalProps> = ({
  isOpen,
  onClose,
  deliveryBoy,
  customersToday,
  mealTime,
  branch,
  dateStr,
  onApplyNewOrder,
  onUpdateHubLocation
}) => {
  const [isApplying, setIsApplying] = useState(false);
  const [appliedSuccess, setAppliedSuccess] = useState(false);
  const [isEditingHub, setIsEditingHub] = useState(false);
  const [hubAddressInput, setHubAddressInput] = useState('');
  const [hubLinkInput, setHubLinkInput] = useState('');
  const [isSavingHub, setIsSavingHub] = useState(false);
  const [recalcCount, setRecalcCount] = useState(0);

  // Sync Hub Form when branch changes
  useEffect(() => {
    setHubAddressInput(branch?.hubAddress || `${branch?.name || 'Kitchen Hub'}, ${branch?.city || ''}`);
    setHubLinkInput(branch?.hubLocationLink || '');
  }, [branch]);

  // Construct Hub object
  const currentHub: HubLocation = useMemo(() => {
    return {
      name: branch?.name || 'Main Kitchen Hub',
      address: branch?.hubAddress || `${branch?.name || 'Kitchen Hub'}, ${branch?.city || ''}`,
      locationLink: branch?.hubLocationLink || ''
    };
  }, [branch]);

  // Compute Optimized Route
  const routeResult: OptimizedRouteResult = useMemo(() => {
    return optimizeRouteOrder(currentHub, customersToday);
    // recalcCount triggers re-computation if user clicks recalculate
  }, [currentHub, customersToday, recalcCount]);

  const todayDateStr = dateStr || new Date().toISOString().split('T')[0];

  const handleApplyOrder = async () => {
    if (routeResult.orderedStops.length === 0) return;
    setIsApplying(true);
    try {
      const orderedIds = routeResult.orderedStops.map(s => s.id);
      await onApplyNewOrder(orderedIds);
      setAppliedSuccess(true);
      setTimeout(() => setAppliedSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to apply route order:", err);
      alert("Could not update order sequence.");
    } finally {
      setIsApplying(false);
    }
  };

  const handleShareWhatsApp = () => {
    if (!deliveryBoy) return;
    const text = formatWhatsAppOptimizedRoute(
      mealTime,
      todayDateStr,
      deliveryBoy,
      routeResult
    );
    const cleanMobile = (deliveryBoy.mobile || '').replace(/\D/g, '');
    window.open(`https://wa.me/${cleanMobile}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleSaveHub = async () => {
    if (!onUpdateHubLocation || !branch?.id) {
      setIsEditingHub(false);
      return;
    }
    setIsSavingHub(true);
    try {
      await onUpdateHubLocation(branch.id, hubAddressInput, hubLinkInput);
      setIsEditingHub(false);
    } catch (err) {
      console.error("Failed to save hub:", err);
      alert("Failed to save hub location.");
    } finally {
      setIsSavingHub(false);
    }
  };

  if (!isOpen) return null;

  const totalBoxes = customersToday.reduce((acc, c) => {
    const plans = getCustomerScheduledPlansForSession(c, mealTime, dateStr || new Date().toISOString().split('T')[0]);
    const count = plans.reduce((s: number, p: any) => s + (Number(p.quantity) || 1), 0);
    return acc + (count || 1);
  }, 0);

  const hasCoordsOnHub = Boolean(extractCoordinates(currentHub.locationLink));
  const stopsWithCoordsCount = routeResult.orderedStops.filter(s => s.hasExactCoordinates).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200">
        
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex justify-between items-center relative overflow-hidden">
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-primary-600/30 border border-primary-500/40 text-primary-400 flex items-center justify-center">
              <Compass size={24} className="animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black uppercase tracking-tight">Shortest Route Optimizer</h2>
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                  <Sparkles size={10} /> Zero Cost Algorithm
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Round-Trip Route: <strong className="text-white font-bold">{routeResult.hub.name}</strong> ➔ {routeResult.orderedStops.length} Orders ➔ Return to Hub
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors relative z-10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          
          {/* Partner & Meal Summary Strip */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 font-black text-sm">
                {deliveryBoy?.name?.charAt(0) || 'D'}
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivery Partner</p>
                <h4 className="text-base font-black text-slate-900 uppercase">{deliveryBoy?.name} <span className="text-xs font-mono font-normal text-slate-400">({deliveryBoy?.mobile})</span></h4>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider ${
                mealTime === 'Breakfast' ? 'bg-orange-100 text-orange-700' :
                mealTime === 'Lunch' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
              }`}>
                {mealTime} Session
              </span>
              <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-xl text-xs font-bold font-mono">
                {formatDateDDMMYYYY(todayDateStr)}
              </span>
            </div>
          </div>

          {/* Hub Location Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary-600">
                <MapPin size={18} />
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Branch Kitchen Hub (Origin & Return)</h4>
              </div>
              <button 
                onClick={() => setIsEditingHub(!isEditingHub)}
                className="text-[11px] font-bold text-primary-600 hover:text-primary-800 flex items-center gap-1 uppercase tracking-tight"
              >
                <Edit3 size={13} /> {isEditingHub ? 'Cancel' : 'Edit Hub Pin'}
              </button>
            </div>

            {isEditingHub ? (
              <div className="space-y-3 pt-2 border-t border-slate-100 animate-in fade-in">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Hub Address</label>
                  <input 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="e.g. #14, 100 Feet Road, Indiranagar, Bengaluru"
                    value={hubAddressInput}
                    onChange={e => setHubAddressInput(e.target.value)}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 block">Google Maps Link or GPS Coordinates</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(
                              (pos) => {
                                const latLng = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
                                setHubLinkInput(latLng);
                                if (!hubAddressInput || hubAddressInput.includes('Mumbai')) {
                                  setHubAddressInput(`Kitchen Hub (${latLng})`);
                                }
                              },
                              (err) => alert("Could not fetch device location: " + err.message)
                            );
                          }
                        }}
                        className="text-[10px] font-bold text-primary-600 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 px-2 py-0.5 rounded transition-colors"
                      >
                        📍 Use My Live GPS
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // Find centroid from customers today
                          const coordsList: { lat: number; lng: number }[] = [];
                          customersToday.forEach(c => {
                            const parsed = extractCoordinates(c.locationLink) || extractCoordinates(c.address);
                            if (parsed) coordsList.push(parsed);
                          });
                          if (coordsList.length > 0) {
                            const avgLat = coordsList.reduce((sum, c) => sum + c.lat, 0) / coordsList.length;
                            const avgLng = coordsList.reduce((sum, c) => sum + c.lng, 0) / coordsList.length;
                            const latLng = `${avgLat.toFixed(6)}, ${avgLng.toFixed(6)}`;
                            setHubLinkInput(latLng);
                            if (!hubAddressInput || hubAddressInput.includes('Mumbai')) {
                              setHubAddressInput(`Bengaluru Kitchen Hub (${latLng})`);
                            }
                          } else {
                            setHubLinkInput('12.9716, 77.5946');
                            setHubAddressInput('Bengaluru Central Kitchen Hub');
                          }
                        }}
                        className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded transition-colors"
                      >
                        📍 Align to Customer Orders
                      </button>
                    </div>
                  </div>
                  <input 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Paste Google Maps URL or 12.9716, 77.5946"
                    value={hubLinkInput}
                    onChange={e => setHubLinkInput(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button 
                    onClick={() => setIsEditingHub(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveHub}
                    disabled={isSavingHub}
                    className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5"
                  >
                    <Save size={14} /> {isSavingHub ? 'Saving...' : 'Save Hub Location'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div>
                  <p className="font-bold text-slate-800">{routeResult.hub.address || currentHub.address}</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate max-w-md">
                    {currentHub.locationLink || (routeResult.hub.lat ? `Hub GPS Pin: ${routeResult.hub.lat.toFixed(5)}, ${routeResult.hub.lng.toFixed(5)}` : 'City Center Hub')}
                  </p>
                </div>
                {currentHub.locationLink && (
                  <a 
                    href={currentHub.locationLink.startsWith('http') ? currentHub.locationLink : `https://${currentHub.locationLink}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-primary-600 font-bold flex items-center gap-1 text-[11px] uppercase tracking-wide hover:underline shrink-0"
                  >
                    View Hub Map <ExternalLink size={13} />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Optimization Metrics Bento */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Round-Trip Distance</p>
              <h3 className="text-2xl font-black text-slate-900">~{routeResult.totalDistanceKm} <span className="text-xs font-bold text-slate-400">km</span></h3>
              <p className="text-[9px] text-emerald-600 font-bold mt-1">Shortest Path Solved</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Est. Travel Time</p>
              <h3 className="text-2xl font-black text-slate-900">~{routeResult.totalEstMinutes} <span className="text-xs font-bold text-slate-400">mins</span></h3>
              <p className="text-[9px] text-slate-500 font-bold mt-1">Driving + 3m per drop</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Deliveries</p>
              <h3 className="text-2xl font-black text-primary-600">{routeResult.orderedStops.length} <span className="text-xs font-bold text-slate-400">Stops</span></h3>
              <p className="text-[9px] text-slate-500 font-bold mt-1">{totalBoxes} Total Meal Boxes</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Map Links Pin Status</p>
              <h3 className="text-2xl font-black text-slate-900">{stopsWithCoordsCount}<span className="text-xs font-bold text-slate-400">/{routeResult.orderedStops.length}</span></h3>
              <p className="text-[9px] text-blue-600 font-bold mt-1">GPS Coordinates Active</p>
            </div>
          </div>

          {/* Action Hub Banner */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-3xl space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <h3 className="text-base font-black uppercase tracking-tight flex items-center gap-2">
                  <Navigation size={18} className="text-emerald-400" /> Dispatch & Navigation Actions
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Share the optimal turn-by-turn route with {deliveryBoy?.name} or update the live sequence.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRecalcCount(prev => prev + 1)}
                  className="px-3.5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-white/10 hover:bg-white/20 text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  title="Re-run shortest route optimizer calculation"
                >
                  <RefreshCw size={14} className={recalcCount > 0 ? "animate-spin-once" : ""} /> Re-calculate
                </button>

                <button
                  onClick={handleApplyOrder}
                  disabled={isApplying || appliedSuccess}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    appliedSuccess 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-white text-slate-900 hover:bg-slate-100 active:scale-95 shadow-md'
                  }`}
                >
                  {appliedSuccess ? (
                    <>
                      <CheckCircle2 size={16} /> Sequence Saved!
                    </>
                  ) : (
                    <>
                      <Save size={16} /> {isApplying ? 'Applying Sequence...' : 'Save Sequence as Default'}
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/10">
              <button
                onClick={handleShareWhatsApp}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 px-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-500/20 active:scale-98 transition-all"
              >
                <MessageSquare size={18} fill="currentColor" /> Share Shortest Route on WhatsApp
              </button>

              <a
                href={routeResult.masterGoogleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-lg shadow-blue-600/20 active:scale-98 transition-all text-center"
              >
                <ExternalLink size={18} /> Open Master Google Maps Route
              </a>
            </div>

            {routeResult.googleMapsLegsUrls.length > 1 && (
              <div className="bg-white/5 p-3 rounded-xl border border-white/10 text-xs">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1.5">
                  Route Split into {routeResult.googleMapsLegsUrls.length} Google Maps Sections (&le;9 stops per navigation leg):
                </p>
                <div className="flex flex-wrap gap-2">
                  {routeResult.googleMapsLegsUrls.map((url, idx) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                    >
                      Leg {idx + 1} (Stops {idx * 9 + 1}–{Math.min((idx + 1) * 9, routeResult.orderedStops.length)}) <ExternalLink size={11} />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sequential Route Itinerary */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
                <Layers size={16} className="text-primary-600" />
                Optimized Stop-by-Stop Itinerary ({routeResult.orderedStops.length} Stops)
              </h4>
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                Sorted by Proximity
              </span>
            </div>

            <div className="space-y-2.5">
              {/* Start Node */}
              <div className="bg-slate-100/80 p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-900 text-white font-black text-xs flex items-center justify-center shrink-0">
                    🏁
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">STARTING POINT</span>
                    <h5 className="font-black text-slate-900 uppercase">{currentHub.name} (Kitchen Hub)</h5>
                    <p className="text-[11px] text-slate-500 truncate max-w-md">{currentHub.address}</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold text-slate-400 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                  0.0 km
                </span>
              </div>

              {/* Customer Stops */}
              {routeResult.orderedStops.map((stop) => {
                const sessionPlans = getCustomerScheduledPlansForSession(stop, mealTime, dateStr || new Date().toISOString().split('T')[0]);
                const isStarred = sessionPlans.some((p: any) => p.isStarred) || (stop.highlightMark && stop.highlightMark !== 'None');

                return (
                  <div 
                    key={stop.id}
                    className={`bg-white p-4 rounded-2xl border transition-all hover:shadow-md ${
                      isStarred ? 'border-amber-300 bg-amber-50/10' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 border border-primary-200 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                          #{stop.sequence}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="font-black text-slate-900 text-sm uppercase">{stop.name}</h5>
                            {isStarred && (
                              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[9px] font-black px-2 py-0.5 rounded-full border border-amber-300">
                                <Star size={10} fill="currentColor" /> Special Alert
                              </span>
                            )}
                          </div>
                          
                          <p className="text-xs text-slate-600 font-medium mt-0.5">
                            {stop.address}{stop.area ? `, ${stop.area}` : ''}
                          </p>

                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {sessionPlans.map((sp: any, i: number) => {
                              const boxType = sp.reusableBoxType;
                              const isReusable = boxType && boxType !== 'None';
                              const dayNum = isReusable ? getPlanDeliveryDayNumber(sp.startDate, todayDateStr, sp.weekdays || [1, 2, 3, 4, 5, 6], sp.pauses || []) : 0;

                              return (
                                <React.Fragment key={i}>
                                  <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                                    {sp.planName} {sp.isStarred && '⭐'}
                                  </span>

                                  {isReusable && (
                                    dayNum >= 2 ? (
                                      <span className="text-[10px] font-bold bg-amber-500/15 text-amber-900 border border-amber-400/40 px-2.5 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                        🔄 Recollect: Yesterday's {boxType} (Day {dayNum})
                                      </span>
                                    ) : dayNum === 1 ? (
                                      <span className="text-[10px] font-semibold bg-emerald-500/15 text-emerald-800 border border-emerald-400/30 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                                        🟢 Day 1: New {boxType} (No collection)
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200">
                                        🍱 {boxType}
                                      </span>
                                    )
                                  )}
                                </React.Fragment>
                              );
                            })}
                            {stop.notes && (
                              <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                                Note: {stop.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Distance</span>
                          <span className="text-xs font-black text-slate-900">+{stop.distanceFromPrevKm} km</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <a 
                            href={`tel:${stop.mobile}`}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                            title={`Call ${stop.name}`}
                          >
                            <Phone size={14} />
                          </a>
                          <a 
                            href={stop.directNavUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-xs flex items-center gap-1 transition-colors"
                          >
                            <Navigation size={13} /> Navigate
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* End Node: Return to Hub */}
              <div className="bg-slate-100/80 p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    🏁
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600">FINAL RETURN</span>
                    <h5 className="font-black text-slate-900 uppercase">Return to {currentHub.name}</h5>
                    <p className="text-[11px] text-slate-500">Trip complete. All tiffin boxes delivered.</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                  Total ~{routeResult.totalDistanceKm} km
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center text-xs">
          <p className="text-slate-400 font-medium">
            💡 Calculated with zero Google Maps API consumption via ScaleKitchen TSP Solver.
          </p>
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 text-white font-black uppercase tracking-wider rounded-xl hover:bg-slate-800 transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
