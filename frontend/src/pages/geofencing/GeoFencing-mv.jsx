import React, { useState, useEffect } from 'react';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { MapPin, Plus, Users, Search, X, Check, CheckCircle2 } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { toast } from 'react-toastify';

const GeoFencing = () => {
    // Mock Data based on screenshot, now with assignedStaff field
    const [locations, setLocations] = useState([
        { id: 1, name: 'Main Office (Renamed)', address: '123 Tech Park, Chennai', active: true, assignedStaff: [] },
        { id: 2, name: 'Remote Hub', address: 'Remote / WFH', active: false, assignedStaff: [] },
        { id: 3, name: 'Main Office', address: '123 Tech Park, Chennai', active: false, assignedStaff: [] },
        { id: 4, name: 'test geofence', address: 'dadar', active: false, assignedStaff: [] },
        { id: 5, name: 'mankhurd BARC', address: 'Lallubhai Compound, Govandi East, M/E Ward, Zone 5, Mumbai, Mumbai', active: true, assignedStaff: [] },
        { id: 6, name: 'Dharavi', address: '90 Feet Road, Laxmi Baug, G/N Ward, Zone 2, Mumbai, Mumbai City,', active: true, assignedStaff: [] },
        { id: 7, name: 'Dadar Office', address: 'Platform 13-14, Tilak Bridge, Dadar West, G/N Ward, Zone 2, Mumbai, Mumbai', active: false, assignedStaff: [] },
        { id: 8, name: 'testing', address: 'testing', active: false, assignedStaff: [] },
    ]);

    const [staff, setStaff] = useState([]);
    const [loadingStaff, setLoadingStaff] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [staffSearchTerm, setStaffSearchTerm] = useState('');
    const [tempSelectedStaff, setTempSelectedStaff] = useState([]); // IDs of staff selected in modal

    useEffect(() => {
        fetchStaff();
    }, []);

    const fetchStaff = async () => {
        setLoadingStaff(true);
        try {
            const data = await adminService.getAllUsers(true);
            if (data.success) {
                setStaff(data.users.map(u => ({
                    id: u.user_id,
                    name: u.user_name,
                    role: u.desg_name || u.user_type,
                    image: u.profile_image_url
                })));
            }
        } catch (error) {
            console.error("Failed to fetch staff", error);
            // toast.error("Could not load staff list");
        } finally {
            setLoadingStaff(false);
        }
    };

    const openAssignModal = (location) => {
        setSelectedLocation(location);
        setTempSelectedStaff(location.assignedStaff || []);
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

    const handleSaveAssignments = () => {
        setLocations(prevLocations =>
            prevLocations.map(loc =>
                loc.id === selectedLocation.id
                    ? { ...loc, assignedStaff: tempSelectedStaff }
                    : loc
            )
        );
        toast.success(`Staff assigned to ${selectedLocation.name}`);
        setIsModalOpen(false);
    };

    const filteredStaff = staff.filter(s =>
        s.name.toLowerCase().includes(staffSearchTerm.toLowerCase()) ||
        s.role.toLowerCase().includes(staffSearchTerm.toLowerCase())
    );

    return (
        <MobileDashboardLayout title="Geo-Fencing">
            <div className="space-y-3 pb-20">
                {locations.map((loc) => (
                    <div key={loc.id} className="bg-white dark:bg-dark-card rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex-1 pr-4">
                                <h3
                                    onClick={() => openAssignModal(loc)}
                                    className="font-bold text-slate-800 dark:text-white text-sm mb-1 flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition-colors"
                                >
                                    {loc.name}
                                    <span className="bg-indigo-50 text-indigo-600 p-1 rounded-full text-[10px]">
                                        <Users size={12} />
                                    </span>
                                </h3>
                                <p className="text-xs text-slate-400 line-clamp-2 mb-2">{loc.address}</p>
                            </div>
                            <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${loc.active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                        </div>

                        {/* Action Bar */}
                        <div className="flex justify-between items-center pt-3 border-t border-slate-50 dark:border-slate-800">
                            <div className="flex items-center gap-1" onClick={() => openAssignModal(loc)}>
                                <div className="flex -space-x-2 overflow-hidden">
                                    {loc.assignedStaff && loc.assignedStaff.length > 0 ? (
                                        <>
                                            {loc.assignedStaff.slice(0, 3).map((staffId, i) => {
                                                const s = staff.find(st => st.id === staffId);
                                                return (
                                                    <div key={i} className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-slate-800 bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-600">
                                                        {s ? (s.image ? <img src={s.image} alt="" className="w-full h-full rounded-full object-cover" /> : s.name.charAt(0)) : '?'}
                                                    </div>
                                                );
                                            })}
                                            {loc.assignedStaff.length > 3 && (
                                                <div className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-slate-800 bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-600">
                                                    +{loc.assignedStaff.length - 3}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <span className="text-[10px] text-slate-400 italic pl-1">No staff assigned</span>
                                    )}
                                </div>
                            </div>
                            {/* <button
                                onClick={() => openAssignModal(loc)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold active:scale-95 transition-transform"
                            >
                                <Users size={14} /> Assign Staff
                            </button> */}
                        </div>
                    </div>
                ))}
            </div>

            {/* Floating Action Button */}
            <button className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-2xl shadow-xl flex items-center justify-center active:scale-90 transition-transform z-10">
                <Plus size={32} />
            </button>

            {/* Assign Staff Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white">Assign Staff</h3>
                                <p className="text-xs text-slate-500">{selectedLocation?.name}</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500">
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
                </div>
            )}
        </MobileDashboardLayout>
    );
};

export default GeoFencing;
