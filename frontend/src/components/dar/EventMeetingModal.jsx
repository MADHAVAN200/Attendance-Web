import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { motion } from 'framer-motion';
import {
    X,
    Clock,
    MapPin,
    AlignLeft,
    Link as LinkIcon,
    Video,
    Users,
    Bell,
    Calendar as CalendarIcon,
    Trash2
} from 'lucide-react';

const EventMeetingModal = ({ onClose, onSave, type = 'Meeting', initialDate = new Date().toISOString().split('T')[0], initialData = null }) => {
    const [selectedType, setSelectedType] = useState(type); // 'Event' or 'Meeting'
    const isEdit = !!initialData;

    // Form State
    const [title, setTitle] = useState('');
    const [date, setDate] = useState(initialDate);
    const [startTime, setStartTime] = useState('10:00');
    const [endTime, setEndTime] = useState('11:00');
    const [isTimeEditing, setIsTimeEditing] = useState(false);

    const [locationType, setLocationType] = useState('online'); // 'online' | 'offline'
    const [meetLink, setMeetLink] = useState('');
    const [address, setAddress] = useState('');
    const [description, setDescription] = useState('');

    // Event Specific State
    const [guests, setGuests] = useState('');
    const [reminder, setReminder] = useState(30);

    // Mentions system state
    const [orgUsers, setOrgUsers] = useState([]);
    const [activeMention, setActiveMention] = useState(false);
    const [mentionSearch, setMentionSearch] = useState('');

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await api.get('/collaboration/users');
                if (res.data.success) {
                    setOrgUsers(res.data.data);
                }
            } catch (err) {
                console.warn("Failed to load organization directory for mentions", err);
            }
        };
        fetchUsers();
    }, []);

    const handleDescriptionChange = (value) => {
        setDescription(value);
        
        const lastAtIndex = value.lastIndexOf('@');
        if (lastAtIndex !== -1 && (lastAtIndex === 0 || value[lastAtIndex - 1] === ' ')) {
            const search = value.substring(lastAtIndex + 1);
            if (search.length < 20 && !search.includes(' ') && !search.includes('\n')) {
                setActiveMention(true);
                setMentionSearch(search);
            } else {
                setActiveMention(false);
                setMentionSearch('');
            }
        } else {
            setActiveMention(false);
            setMentionSearch('');
        }
    };

    const insertMention = (user) => {
        const lastAtIndex = description.lastIndexOf('@');
        const prefix = description.substring(0, lastAtIndex);
        const newVal = `${prefix}@${user.user_name} `;
        setDescription(newVal);
        setActiveMention(false);
        setMentionSearch('');
    };

    // Initialize from initialData if editing
    useEffect(() => {
        if (initialData) {
            setTitle(initialData.title || '');
            setDate(initialData.date || initialDate);
            setStartTime(initialData.startTime || '10:00');
            setEndTime(initialData.endTime || '11:00');
            setDescription(initialData.description || '');
            setSelectedType(initialData.type === 'event' ? 'Event' : 'Meeting');

            // Location detection
            const loc = initialData.location || '';
            const isUrl = /^(http|https):\/\/[^ "]+$/.test(loc);
            if (isUrl) {
                setLocationType('online');
                setMeetLink(loc);
            } else {
                setLocationType('offline');
                setAddress(loc);
            }
        }
    }, [initialData]);

    // Smart Time Initialization (Only for Create Mode)
    useEffect(() => {
        if (isEdit) return; // Don't overwrite if editing

        const now = new Date();
        let minutes = now.getMinutes();
        let hours = now.getHours();

        // Round to next 30 min
        if (minutes < 30) {
            minutes = 30;
        } else {
            minutes = 0;
            hours += 1;
        }

        // Format to HH:MM
        const pad = (n) => n.toString().padStart(2, '0');
        const startStr = `${pad(hours)}:${pad(minutes)}`;

        // End time + 1 hr
        const endHours = (hours + 1) % 24;
        const endStr = `${pad(endHours)}:${pad(minutes)}`;

        setStartTime(startStr);
        setEndTime(endStr);
    }, [isEdit]);

    const formatTimeDisplay = (timeStr) => {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':');
        const d = new Date();
        d.setHours(parseInt(h), parseInt(m));
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase().replace(' ', '');
    };

    const formattedDateString = new Date(date).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
    const fullTimeString = `${formattedDateString}  ${formatTimeDisplay(startTime)} – ${formatTimeDisplay(endTime)}`;

    const handleSubmit = async () => {
        // Collect data based on type
        const payload = {
            type: selectedType.toUpperCase(), // Backend expects uppercase ENUM
            title,
            start_time: startTime, // Backend expects snake_case
            end_time: endTime,
            description,
            event_date: new Date(date).toISOString().split('T')[0]
        };

        if (selectedType === 'Meeting' || selectedType === 'Meeting'.toUpperCase()) {
            payload.location = locationType === 'online' ? meetLink : address;
        } else {
            payload.location = address;
        }

        try {
            if (isEdit) {
                // Ensure ID is stripped of prefix if present (though initialData.id usually has it)
                // We need raw ID for backend.
                // Assuming initialData.id passed from parent is cleaner raw ID or handled there.
                // Actually DailyActivity passes raw ID stripped of prefix for Tasks.
                // Let's assume parent deals with ID extracting or we strip here.
                const rawId = initialData.id.toString().replace('evt-', '');
                await api.put(`/dar/events/update/${rawId}`, payload);
            } else {
                await api.post('/dar/events/create', payload);
            }
            if (onSave) onSave(payload); // Refresh list
            onClose();
        } catch (err) {
            console.error(isEdit ? "Failed to update" : "Failed to create", err);
            alert((err.response?.data?.message) || (isEdit ? "Failed to update" : "Failed to create"));
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            {/* Backdrop (Optional, removed to allow seeing behind if desired, but kept invisible capture for blocking clicks if needed) */}

            <motion.div
                drag
                dragMomentum={false}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white dark:bg-dark-card w-[500px] rounded-xl shadow-2xl border border-gray-200 dark:border-github-dark-border overflow-hidden pointer-events-auto cursor-default flex flex-col font-sans"
            >
                {/* Header / Drag Handle */}
                <div className="bg-gray-50 dark:bg-dark-card/50 p-3 px-4 flex justify-between items-center border-b border-gray-100 dark:border-github-dark-border cursor-grab active:cursor-grabbing">
                    <div className="flex gap-2">
                        {/* Type Switcher */}
                        <button
                            disabled={isEdit}
                            onClick={() => setSelectedType('Event')}
                            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${selectedType === 'Event' || selectedType === 'EVENT' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200 bg-gray-100'} ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            Event
                        </button>
                        <button
                            disabled={isEdit}
                            onClick={() => setSelectedType('Meeting')}
                            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${selectedType === 'Meeting' || selectedType === 'MEETING' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200 bg-gray-100'} ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            Meeting
                        </button>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 flex flex-col gap-5 max-h-[70vh] overflow-y-auto">

                    {/* Title */}
                    <div>
                        <input
                            type="text"
                            placeholder="Add title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full text-2xl font-normal text-slate-800 dark:text-gray-100 placeholder:text-slate-400 border-b-2 border-transparent focus:border-blue-500 focus:outline-none py-1 bg-transparent transition-colors"
                            autoFocus
                        />
                    </div>

                    {/* Time Section (Interactive) */}
                    <div className="flex items-start gap-4">
                        <Clock className="w-5 h-5 text-gray-400 mt-2 shrink-0" />
                        <div className="flex-1">
                            {!isTimeEditing ? (
                                <div
                                    onClick={() => setIsTimeEditing(true)}
                                    className="py-2 px-1 -ml-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded cursor-pointer transition-colors"
                                >
                                    {fullTimeString}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="flex items-center gap-2">
                                        {/* Date Picker */}
                                        <input
                                            type="date"
                                            disabled={isEdit}
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            className={`px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-github-dark-border rounded-md text-sm text-gray-800 dark:text-gray-100 focus:border-blue-500 outline-none hover:bg-white dark:hover:bg-slate-600 transition-colors ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        />

                                        {/* Start Time */}
                                        <input
                                            type="time"
                                            value={startTime}
                                            onChange={(e) => setStartTime(e.target.value)}
                                            className="px-2 py-2 w-28 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-github-dark-border rounded-md text-sm text-gray-800 dark:text-gray-100 focus:border-blue-500 outline-none hover:bg-white dark:hover:bg-slate-600 transition-colors text-center"
                                        />

                                        <span className="text-gray-400 text-sm">–</span>

                                        {/* End Time */}
                                        <input
                                            type="time"
                                            value={endTime}
                                            onChange={(e) => setEndTime(e.target.value)}
                                            className="px-2 py-2 w-28 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-github-dark-border rounded-md text-sm text-gray-800 dark:text-gray-100 focus:border-blue-500 outline-none hover:bg-white dark:hover:bg-slate-600 transition-colors text-center"
                                        />
                                    </div>

                                </div>
                            )}
                        </div>
                    </div>

                    {/* Conditional Fields based on Type */}
                    {selectedType === 'Meeting' ? (
                        <>
                            {/* Location / Meeting Mode */}
                            <div className="flex items-start gap-4">
                                {locationType === 'online' ? <Video className="w-5 h-5 text-gray-400 mt-2 shrink-0" /> : <MapPin className="w-5 h-5 text-gray-400 mt-2 shrink-0" />}
                                <div className="flex-1 flex flex-col gap-3">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setLocationType('online')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-medium border ${locationType === 'online' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300' : 'border-gray-200 dark:border-github-dark-border text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700/50'}`}
                                        >
                                            Online Meeting
                                        </button>
                                        <button
                                            onClick={() => setLocationType('offline')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-medium border ${locationType === 'offline' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300' : 'border-gray-200 dark:border-github-dark-border text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700/50'}`}
                                        >
                                            In-Person
                                        </button>
                                    </div>

                                    {locationType === 'online' ? (
                                        <div className="w-full relative flex gap-2">
                                            <div className="relative flex-1">
                                                <input
                                                    type="text"
                                                    placeholder="Add Google Meet or Zoom link"
                                                    value={meetLink}
                                                    onChange={(e) => setMeetLink(e.target.value)}
                                                    className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-github-dark-border rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                                                />
                                                <LinkIcon size={14} className="absolute left-3 top-2.5 text-gray-400" />
                                            </div>

                                            {/* Copy/Redirect Actions */}
                                            {meetLink && (
                                                <div className="flex gap-1">
                                                    <a
                                                        href={meetLink.startsWith('http') ? meetLink : `https://${meetLink}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-lg text-blue-600 dark:text-blue-400 transition-colors flex items-center justify-center"
                                                        title="Open Link"
                                                    >
                                                        <Video size={16} />
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="w-full relative">
                                            <input
                                                type="text"
                                                placeholder="Add meeting location/address"
                                                value={address}
                                                onChange={(e) => setAddress(e.target.value)}
                                                className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-github-dark-border rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                                            />
                                            <MapPin size={14} className="absolute left-3 top-2.5 text-gray-400" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* EVENT SPECIFIC FIELDS */}
                            {/* Guests */}


                            {/* Location (Optional for Event) */}
                            <div className="flex items-start gap-4">
                                <MapPin className="w-5 h-5 text-gray-400 mt-2 shrink-0" />
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        placeholder="Add location"
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        className="w-full py-2 bg-transparent border-b border-gray-100 dark:border-github-dark-border hover:border-gray-300 dark:hover:border-slate-500 focus:border-indigo-500 outline-none text-sm transition-colors text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                                    />
                                </div>
                            </div>

                            {/* Notification */}
                            <div className="flex items-start gap-4">
                                <Bell className="w-5 h-5 text-gray-400 mt-2 shrink-0" />
                                <div className="flex-1">
                                    <select
                                        value={reminder}
                                        onChange={(e) => setReminder(e.target.value)}
                                        className="w-full py-2 bg-transparent border-b border-gray-100 dark:border-github-dark-border hover:border-gray-300 dark:hover:border-slate-500 focus:border-indigo-500 outline-none text-sm cursor-pointer text-gray-600 dark:text-gray-300 [&>option]:text-gray-800 dark:[&>option]:bg-slate-800 dark:[&>option]:text-gray-200"
                                    >
                                        <option value={10}>Notify 10 minutes before</option>
                                        <option value={30}>Notify 30 minutes before</option>
                                        <option value={60}>Notify 1 hour before</option>
                                        <option value={1440}>Notify 1 day before</option>
                                    </select>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Description (Common) */}
                    <div className="flex items-start gap-4">
                        <AlignLeft className="w-5 h-5 text-gray-400 mt-2 shrink-0" />
                        <div className="flex-1 relative">
                            <textarea
                                placeholder="Add description"
                                value={description}
                                onChange={(e) => handleDescriptionChange(e.target.value)}
                                rows={3}
                                className="w-full py-2 bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-github-dark-border rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:border-indigo-500 outline-none resize-none transition-colors"
                            />

                            {/* Mention Suggestions Dropdown */}
                            {activeMention && (
                                <div className="absolute left-0 right-0 bottom-full mb-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden py-1 max-h-40 overflow-y-auto">
                                    <div className="px-3 py-1 text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-white/5 tracking-wider">
                                        Mention Team Member
                                    </div>
                                    {orgUsers
                                        .filter(u =>
                                            u.user_name.toLowerCase().includes(mentionSearch.toLowerCase())
                                        )
                                        .slice(0, 5)
                                        .map(u => (
                                            <button
                                                key={u.user_id}
                                                type="button"
                                                onClick={() => insertMention(u)}
                                                className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/30 flex items-center gap-2.5 transition-colors border-none bg-transparent cursor-pointer"
                                            >
                                                {u.profile_image_url ? (
                                                    <img src={u.profile_image_url} alt={u.user_name} className="w-5 h-5 rounded-md object-cover" />
                                                ) : (
                                                    <div className="w-5 h-5 rounded-md bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-[9px]">
                                                        {u.user_name.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <div className="truncate">
                                                    <span className="font-bold text-gray-700 dark:text-github-dark-text text-[11px] block truncate">{u.user_name}</span>
                                                </div>
                                            </button>
                                        ))}
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 dark:border-github-dark-border flex justify-between items-center bg-gray-50/50 dark:bg-dark-card/50">
                    <div>
                        {isEdit && (
                            <button
                                onClick={async () => {
                                    if (!window.confirm("Are you sure you want to delete this?")) return;
                                    try {
                                        const rawId = initialData.id.toString().replace('evt-', '');
                                        await api.delete(`/dar/events/delete/${rawId}`);
                                        if (onSave) onSave(); // Refresh
                                        onClose();
                                    } catch (err) {
                                        alert(err.response?.data?.message || "Failed to delete");
                                    }
                                }}
                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Delete"
                            >
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            className="px-6 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200 dark:shadow-none transition-all hover:scale-105 active:scale-95"
                        >
                            {isEdit ? 'Update' : 'Save'}
                        </button>
                    </div>
                </div>

            </motion.div>
        </div>
    );
};

export default EventMeetingModal;
