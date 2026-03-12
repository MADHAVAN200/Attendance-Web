import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { MapPin, Plus, Users, Search, X, Check, CheckCircle2 } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { fetchLocations, fetchWorkLocationUsers, updateLocationAssignments, createLocation } from '../../services/userService';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';

const GeoFencing = () => {
    const [locations, setLocations] = useState([]);
    const [staff, setStaff] = useState([]);
    const [loadingStaff, setLoadingStaff] = useState(false);
    const [loadingLocations, setLoadingLocations] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [staffSearchTerm, setStaffSearchTerm] = useState('');
    const [tempSelectedStaff, setTempSelectedStaff] = useState([]);

    // Create Location State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newGeo, setNewGeo] = useState({
        location_name: "",
        address: "",
        latitude: "",
        longitude: "",
        radius: 100,
    });
    const [isCreating, setIsCreating] = useState(false);

    // Reverse geocoding helper
    const reverseGeocode = async (lat, lng) => {
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
            );
            const data = await res.json();
            return data.display_name || "";
        } catch (err) {
            console.error("Reverse geocoding failed", err);
            return "";
        }
    };

    const useMyLocation = () => {
        if (!navigator.geolocation) {
            toast.error("Geolocation not supported by this browser");
            return;
        }

        toast.info("Fetching your location...");
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;

                setNewGeo((prev) => ({
                    ...prev,
                    latitude: lat,
                    longitude: lng,
                }));

                const address = await reverseGeocode(lat, lng);
                setNewGeo((prev) => ({
                    ...prev,
                    address,
                }));
                toast.success("Location fetched!");
            },
            (err) => toast.error(err.message),
            { enableHighAccuracy: true }
        );
    };

    const handleCreateGeofence = async (e) => {
        e.preventDefault();
        if (!newGeo.location_name || !newGeo.latitude || !newGeo.longitude || !newGeo.address) {
            toast.error("Name, Latitude, Longitude and Address are required");
            return;
        }

        setIsCreating(true);
        try {
            await createLocation({
                location_name: newGeo.location_name,
                address: newGeo.address,
                latitude: Number(newGeo.latitude),
                longitude: Number(newGeo.longitude),
                radius: Number(newGeo.radius),
            });

            toast.success("Location created successfully");
            setIsCreateModalOpen(false);
            setNewGeo({
                location_name: "",
                address: "",
                latitude: "",
                longitude: "",
                radius: 100,
            });
            loadData();
        } catch (err) {
            toast.error("Failed to create location");
            console.error(err);
        } finally {
            setIsCreating(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoadingLocations(true);
        setLoadingStaff(true);
        try {
            const [locRes, usersRes] = await Promise.all([
                fetchLocations(),
                fetchWorkLocationUsers()
            ]);

            if (locRes.ok) setLocations(locRes.locations);

            if (usersRes.success) {
               const processedUsers = usersRes.users.map(u => ({
                    id: u.user_id,
                    name: u.user_name,
                    role: u.desg_name || u.user_type,
                    image: u.profile_image_url,
                    work_locations: (u.work_locations || []).map(wl => {
                        if (wl.loc_id != null) return { location_id: Number(wl.loc_id) };
                        if (typeof wl === "number") return { location_id: wl };
                        const id = wl.location_id ?? wl.work_location_id;
                        return id != null ? { location_id: Number(id) } : null;
                    }).filter(Boolean),
                }));
                setStaff(processedUsers);
            }
        } catch (error) {
            console.error("Failed to load geo fencing data", error);
            toast.error("Could not load data");
        } finally {
            setLoadingLocations(false);
            setLoadingStaff(false);
        }
    };

    const openAssignModal = (location) => {
        setSelectedLocation(location);
        const originallyAssigned = staff
            .filter(s => s.work_locations?.some(wl => wl.location_id === location.location_id))
            .map(s => s.id);
        setTempSelectedStaff(originallyAssigned);
        setStaffSearchTerm('');
        setIsModalOpen(true);
    };

    const toggleStaffSelection = (staffId) => {
        setTempSelectedStaff(prev =>
            prev.includes(staffId)
                ? prev.filter(id => id !== staffId)
                : [...prev, staffId]
        );
    };

    const handleSaveAssignments = async () => {
        const originallyAssigned = staff
            .filter(s => s.work_locations?.some(wl => wl.location_id === selectedLocation.location_id))
            .map(s => s.id);

        const payload = [{
            work_location_id: selectedLocation.location_id,
            add: tempSelectedStaff.filter(id => !originallyAssigned.includes(id)),
            remove: originallyAssigned.filter(id => !tempSelectedStaff.includes(id))
        }];

        try {
            await updateLocationAssignments(payload);
            toast.success(`Staff assignments updated for ${selectedLocation.location_name}`);
            setIsModalOpen(false);
            loadData(); // reload users to get updated work_locations
        } catch (error) {
            toast.error("Failed to update staff assignments");
        }
    };

    const filteredStaff = staff.filter(s =>
        s.name.toLowerCase().includes(staffSearchTerm.toLowerCase()) ||
        s.role.toLowerCase().includes(staffSearchTerm.toLowerCase())
    );

    return (
        <MobileDashboardLayout title="Geo-Fencing">
            <div className="space-y-3 pb-20">
                {loadingLocations ? (
                    <div className="text-center py-10 text-slate-400 text-xs">Loading locations...</div>
                ) : locations.map((loc) => {
                    const assignedStaffIds = staff
                        .filter(s => s.work_locations?.some(wl => wl.location_id === loc.location_id))
                        .map(s => s.id);
                    return (
                        <div key={loc.location_id} className="bg-white dark:bg-dark-card rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex-1 pr-4">
                                    <h3
                                        onClick={() => openAssignModal(loc)}
                                        className="font-bold text-slate-800 dark:text-white text-sm mb-1 flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition-colors"
                                    >
                                        {loc.location_name}
                                        <span className="bg-indigo-50 text-indigo-600 p-1 rounded-full text-[10px]">
                                            <Users size={12} />
                                        </span>
                                    </h3>
                                    <p className="text-xs text-slate-400 line-clamp-2 mb-2">{loc.address}</p>
                                </div>
                                <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${loc.is_active === 1 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                            </div>

                            {/* Action Bar */}
                            <div className="flex justify-between items-center pt-3 border-t border-slate-50 dark:border-slate-800">
                                <div className="flex items-center gap-1" onClick={() => openAssignModal(loc)}>
                                    <div className="flex -space-x-2 overflow-hidden">
                                        {assignedStaffIds.length > 0 ? (
                                            <>
                                                {assignedStaffIds.slice(0, 3).map((staffId, i) => {
                                                    const s = staff.find(st => st.id === staffId);
                                                    return (
                                                        <div key={i} className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-slate-800 bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-600">
                                                            {s ? (s.image ? <img src={s.image} alt="" className="w-full h-full rounded-full object-cover" /> : s.name.charAt(0)) : '?'}
                                                        </div>
                                                    );
                                                })}
                                                {assignedStaffIds.length > 3 && (
                                                    <div className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-slate-800 bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-600">
                                                        +{assignedStaffIds.length - 3}
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <span className="text-[10px] text-slate-400 italic pl-1">No staff assigned</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Floating Action Button */}
            <button 
                onClick={() => setIsCreateModalOpen(true)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 dark:bg-indigo-500 text-white rounded-2xl shadow-[0_4px_20px_rgba(99,102,241,0.4)] flex items-center justify-center hover:bg-indigo-700 hover:scale-105 active:scale-90 transition-all z-[40]"
            >
                <Plus size={28} strokeWidth={2.5} />
            </button>

            {/* Assign Staff Modal */}
            {isModalOpen && createPortal(
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white">Assign Staff</h3>
                                <p className="text-xs text-slate-500">{selectedLocation?.location_name}</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-red-500">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Search */}
                        <div className="p-4 pb-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search employees..."
                                    value={staffSearchTerm}
                                    onChange={(e) => setStaffSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                />
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px]">
                            {loadingStaff ? (
                                <div className="text-center py-10 text-slate-400 text-xs">Loading staff...</div>
                            ) : filteredStaff.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 text-xs">No staff found.</div>
                            ) : (
                                filteredStaff.map(s => {
                                    const isSelected = tempSelectedStaff.includes(s.id);
                                    return (
                                        <div
                                            key={s.id}
                                            onClick={() => toggleStaffSelection(s.id)}
                                            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${isSelected
                                                ? 'bg-indigo-50/50 dark:bg-indigo-900/10'
                                                : 'bg-transparent'
                                                }`}
                                        >
                                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center text-sm font-bold text-slate-600 shrink-0">
                                                {s.image ? <img src={s.image} alt="" className="w-full h-full object-cover" /> : s.name.charAt(0)}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="text-sm font-bold text-slate-800 dark:text-white">{s.name}</h4>
                                                <p className="text-[10px] text-slate-500">{s.role}</p>
                                            </div>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isSelected
                                                ? 'bg-emerald-100 text-emerald-600'
                                                : 'bg-slate-100 text-slate-400 hover:bg-indigo-100 hover:text-indigo-600'
                                                }`}>
                                                {isSelected ? <Check size={16} strokeWidth={3} /> : <Plus size={16} />}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-b-2xl">
                            <button
                                onClick={handleSaveAssignments}
                                className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                <CheckCircle2 size={18} />
                                Confirm Assignment ({tempSelectedStaff.length})
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Create Location Modal */}
            {isCreateModalOpen && createPortal(
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-md p-4 animate-in fade-in duration-200" onClick={() => setIsCreateModalOpen(false)}>
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl flex flex-col shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20 rounded-t-2xl">
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white">Create Location</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Add a new geo-fencing zone</p>
                            </div>
                            <button onClick={() => setIsCreateModalOpen(false)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors rounded-full">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateGeofence} className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5">Location Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={newGeo.location_name}
                                    onChange={(e) => setNewGeo({ ...newGeo, location_name: e.target.value })}
                                    placeholder="e.g. Main Office"
                                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5 flex justify-between items-center">
                                    <span>Coordinates *</span>
                                    <button 
                                        type="button" 
                                        onClick={useMyLocation}
                                        className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-md flex items-center gap-1 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                                    >
                                        <MapPin size={10} /> Use My Loc
                                    </button>
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        type="text"
                                        required
                                        value={newGeo.latitude}
                                        onChange={(e) => setNewGeo({ ...newGeo, latitude: e.target.value })}
                                        placeholder="Lat (e.g. 19.12)"
                                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono"
                                    />
                                    <input
                                        type="text"
                                        required
                                        value={newGeo.longitude}
                                        onChange={(e) => setNewGeo({ ...newGeo, longitude: e.target.value })}
                                        placeholder="Lng (e.g. 72.84)"
                                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5">Address *</label>
                                <textarea
                                    required
                                    value={newGeo.address}
                                    onChange={(e) => setNewGeo({ ...newGeo, address: e.target.value })}
                                    placeholder="Full street address..."
                                    rows="2"
                                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none max-h-[80px]"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5 flex justify-between">
                                    <span>Radius Slider</span>
                                    <span className="text-indigo-600 dark:text-indigo-400">{newGeo.radius}m</span>
                                </label>
                                <input
                                    type="range"
                                    min="10"
                                    max="1000"
                                    step="10"
                                    value={newGeo.radius}
                                    onChange={(e) => setNewGeo({ ...newGeo, radius: e.target.value })}
                                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isCreating}
                                className="w-full py-3 mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isCreating ? (
                                    <>Creating...</>
                                ) : (
                                    <>
                                        <Plus size={18} />
                                        Create Location
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </MobileDashboardLayout>
    );
};

export default GeoFencing;
