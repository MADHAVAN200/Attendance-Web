import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

import {
  fetchLocations,
  fetchWorkLocationUsers,
  createLocation,
  updateLocationAssignments,
  updateLocation
} from "../../services/userService";
import { useMapEvents, useMap } from "react-leaflet";
import DashboardLayout from '../../components/DashboardLayout';
import {
  Map, MapPin, Plus, Search, Navigation, Users, Settings,
  ToggleLeft, ToggleRight, Crosshair, MoreVertical, Check,
  Sun, Moon, Layers, ChevronDown, Edit2, Save, X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const GeoFencing = () => {
  const navigate = useNavigate();

  // Redirect to mobile view if on mobile

  // --- STATE ---
  const { avatarTimestamp } = useAuth();
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [radiusDraft, setRadiusDraft] = useState(100);

  const [showCreateModal, setShowCreateModal] = useState(false);

  // Edit location mode
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [editDraftCoords, setEditDraftCoords] = useState(null);

  // Debounce state for radius save
  const [radiusSaveTimer, setRadiusSaveTimer] = useState(null);

  const [newGeo, setNewGeo] = useState({
    location_name: "",
    address: "",
    latitude: null,
    longitude: null,
    radius: 100,
  });

  const [activeTheme, setActiveTheme] = useState('voyager');
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);

  // --- THEME SYNC ---
  useEffect(() => {
    // Initial sync
    const isDark = document.documentElement.classList.contains('dark');
    setActiveTheme(isDark ? 'dark' : 'voyager');

    // Observe changes to the 'dark' class on the html element
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const darkActive = document.documentElement.classList.contains('dark');
          setActiveTheme(darkActive ? 'dark' : 'voyager');
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  const MAP_THEMES = {
    dark: { name: 'Night Mode', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' },
    light: { name: 'Light Mode', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' },
    voyager: { name: 'Day Mode', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png' },
    satellite: { name: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
    streets: { name: 'Streets', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' }
  };

  const [mapPickEnabled, setMapPickEnabled] = useState(true);
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
  }

  const handleCreateGeofence = async () => {
    if (!newGeo.location_name || !newGeo.latitude || !newGeo.longitude || !newGeo.address) {
      alert("Name and location are required");
      return;
    }

    try {
      await createLocation({
        location_name: newGeo.location_name,
        address: newGeo.address,
        latitude: newGeo.latitude,
        longitude: newGeo.longitude,
        radius: newGeo.radius,
      });

      setShowCreateModal(false);
      setNewGeo({
        location_name: "",
        address: "",
        latitude: null,
        longitude: null,
        radius: 100,
      });

      // refresh locations
      const data = await fetchLocations();
      if (data.ok) {
        setLocations(data.locations);
        setSelectedLocation(data.locations[0]);
      }
    } catch (err) {
      alert("Failed to create geofence");
      console.error(err);
    }
  };

  // Use my location (GPS) handler
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        // IMMEDIATE update → marker shows instantly
        setNewGeo((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
        }));

        // fetch address async (non-blocking)
        const address = await reverseGeocode(lat, lng);
        setNewGeo((prev) => ({
          ...prev,
          address,
        }));
      },
      (err) => alert(err.message),
      { enableHighAccuracy: true }
    );
  };

  // Reset handler
  const resetNewGeo = () => {
    setNewGeo({
      location_name: "",
      address: "",
      latitude: null,
      longitude: null,
      radius: 100,
    });
  };

  // Map click handler (no lag, updates marker immediately)
  const MapClickHandler = () => {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;

        // 1️⃣ IMMEDIATE marker render
        setNewGeo((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
        }));

        // 2️⃣ Async address fetch (does NOT block UI)
        reverseGeocode(lat, lng).then((address) => {
          setNewGeo((prev) => ({
            ...prev,
            address,
          }));
        });
      },
    });
    return null;
  };

  // Map click handler for EDIT mode on main map
  const EditMapClickHandler = () => {
    useMapEvents({
      click(e) {
        if (!isEditingLocation || !editDraftCoords) return;
        const { lat, lng } = e.latlng;
        setEditDraftCoords(prev => ({ ...prev, latitude: lat, longitude: lng, address: '...' }));
        reverseGeocode(lat, lng).then((address) => {
          setEditDraftCoords(prev => prev ? { ...prev, address } : null);
        });
      },
    });
    return null;
  };

  // Start editing — initialize draft from selected location
  const startEditing = () => {
    if (!selectedLocation) return;
    setEditDraftCoords({
      location_name: selectedLocation.location_name,
      latitude: Number(selectedLocation.latitude),
      longitude: Number(selectedLocation.longitude),
      address: selectedLocation.address,
      radius: selectedLocation.radius,
    });
    setIsEditingLocation(true);
  };

  // Use my location in edit mode
  const useMyLocationForEdit = () => {
    if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setEditDraftCoords(prev => prev ? { ...prev, latitude: lat, longitude: lng } : null);
        const address = await reverseGeocode(lat, lng);
        setEditDraftCoords(prev => prev ? { ...prev, address } : null);
      },
      (err) => alert(err.message),
      { enableHighAccuracy: true }
    );
  };

  // Save all edited fields
  const handleSaveEditedLocation = async () => {
    if (!selectedLocation || !editDraftCoords) return;
    if (!editDraftCoords.location_name || !editDraftCoords.latitude || !editDraftCoords.longitude) {
      alert('Name and location are required');
      return;
    }
    try {
      await updateLocation(selectedLocation.location_id, {
        location_name: editDraftCoords.location_name,
        latitude: editDraftCoords.latitude,
        longitude: editDraftCoords.longitude,
        address: editDraftCoords.address,
        radius: editDraftCoords.radius,
      });
      const updated = { ...selectedLocation, ...editDraftCoords };
      setSelectedLocation(updated);
      setLocations(prev => prev.map(loc =>
        loc.location_id === selectedLocation.location_id ? updated : loc
      ));
      setRadiusDraft(editDraftCoords.radius);
      setIsEditingLocation(false);
      setEditDraftCoords(null);
    } catch (err) {
      console.error('Failed to update location', err);
      alert('Failed to save location. Please retry.');
    }
  };

  const handleCancelEdit = () => {
    setIsEditingLocation(false);
    setEditDraftCoords(null);
  };

  // Map recenter helper to fly to selected geofence
  const MapRecenter = ({ location }) => {
    const map = useMap();

    useEffect(() => {
      if (!location) return;

      const lat = Number(location.latitude);
      const lng = Number(location.longitude);

      if (isNaN(lat) || isNaN(lng)) return;

      const currentCenter = map.getCenter();
      const targetLatLng = L.latLng(lat, lng);

      // prevent micro re-fly causing jitter
      if (currentCenter.distanceTo(targetLatLng) < 1) return;

      map.flyTo(targetLatLng, 15, {
        animate: true,
        duration: 0.6,
      });
    }, [location?.location_id]); // only react to actual location change

    return null;
  };

  useEffect(() => {
    const loadLocations = async () => {
      try {
        setLoadingLocations(true);
        const data = await fetchLocations();
        if (data.ok && data.locations.length > 0) {
          setLocations(data.locations);
          setSelectedLocation(data.locations[0]);
        }
      } catch (err) {
        console.error("Failed to fetch locations", err);
      } finally {
        setLoadingLocations(false);
      }
    };

    loadLocations();
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      setRadiusDraft(selectedLocation.radius);
    }
  }, [selectedLocation]);

  // Cleanup effect for radiusSaveTimer
  useEffect(() => {
    return () => {
      if (radiusSaveTimer) {
        clearTimeout(radiusSaveTimer);
      }
    };
  }, [radiusSaveTimer]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoadingUsers(true);
        const data = await fetchWorkLocationUsers();



        if (data?.success) {
          setUsers(
            data.users.map(u => ({
              ...u,
              work_locations: (u.work_locations || [])
                .map(wl => {
                  // ACTUAL backend shape uses loc_id
                  if (wl.loc_id != null) {
                    return { location_id: Number(wl.loc_id) };
                  }

                  // fallback safety (older shapes)
                  if (typeof wl === "number") {
                    return { location_id: wl };
                  }

                  const id = wl.location_id ?? wl.work_location_id;
                  return id != null ? { location_id: Number(id) } : null;
                })
                .filter(Boolean),
            }))
          );
        }
      } catch (err) {
        console.error("Failed to fetch users", err);
      } finally {
        setLoadingUsers(false);
      }
    };

    loadUsers();
  }, []);

  const handleRadiusChange = (newRadius) => {
    setRadiusDraft(newRadius);

    if (!selectedLocation) return;

    // optimistic UI update
    setSelectedLocation(prev => ({
      ...prev,
      radius: newRadius,
    }));

    setLocations(prev =>
      prev.map(loc =>
        loc.location_id === selectedLocation.location_id
          ? { ...loc, radius: newRadius }
          : loc
      )
    );

    // debounce API call
    if (radiusSaveTimer) {
      clearTimeout(radiusSaveTimer);
    }

    const timer = setTimeout(async () => {
      try {
        await updateLocation(selectedLocation.location_id, {
          radius: newRadius,
        });
      } catch (err) {
        console.error("Failed to persist radius", err);
        alert("Failed to save radius");

        // rollback on failure
        const data = await fetchLocations();
        if (data?.ok) {
          setLocations(data.locations);
          setSelectedLocation(
            data.locations.find(
              l => l.location_id === selectedLocation.location_id
            ) || data.locations[0]
          );
        }
      }
    }, 500); // 500ms debounce

    setRadiusSaveTimer(timer);
  };

  const toggleLocationStatus = async () => {
    if (!selectedLocation) return;

    const updatedStatus = selectedLocation.is_active === 1 ? 0 : 1;

    // optimistic UI
    setSelectedLocation(prev => ({
      ...prev,
      is_active: updatedStatus,
    }));

    setLocations(prev =>
      prev.map(loc =>
        loc.location_id === selectedLocation.location_id
          ? { ...loc, is_active: updatedStatus }
          : loc
      )
    );

    try {
      await updateLocation(selectedLocation.location_id, {
        is_active: updatedStatus,
      });
    } catch (err) {
      console.error("Failed to update is_active", err);
      alert("Failed to update geofence status");

      // rollback on failure
      const data = await fetchLocations();
      if (data?.ok) {
        setLocations(data.locations);
        setSelectedLocation(
          data.locations.find(
            l => l.location_id === selectedLocation.location_id
          ) || data.locations[0]
        );
      }
    }
  };

  // A user can have MULTIPLE work locations.
  // Assignments are additive, not exclusive.
  // Disabling a location does NOT delete assignments.
  const toggleUserAssignment = async (userId, isAssigned) => {
    if (!selectedLocation) return;

    const payload = [
      {
        work_location_id: selectedLocation.location_id,
        add: isAssigned ? [] : [userId],
        remove: isAssigned ? [userId] : [],
      },
    ];

    const employee = users.find(u => u.user_id === userId);
    const empName = employee ? employee.user_name : "Employee";

    try {
      // optimistic UI update
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === userId
            ? {
              ...u,
              work_locations: isAssigned
                ? u.work_locations.filter(
                  (w) => w.location_id !== selectedLocation.location_id
                )
                : [
                  ...(u.work_locations || []),
                  { location_id: Number(selectedLocation.location_id) },
                ],
            }
            : u
        )
      );

      await updateLocationAssignments(payload);
      if (isAssigned) {
        toast.success(`${empName} removed from ${selectedLocation.location_name}`);
      } else {
        toast.success(`${empName} assigned to ${selectedLocation.location_name}`);
      }
    } catch (err) {
      console.error("Assignment update failed", err);
      toast.error("Failed to update assignment. Please retry.");

      // rollback on failure
      const data = await fetchWorkLocationUsers();
      if (data?.success) {
        setUsers(data.users);
      }
    }
  };

  if (loadingLocations) {
    return (
      <DashboardLayout title="Geo-Fencing">
        <div className="p-6 text-slate-500">Loading locations...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Geo-Fencing" noPadding={true}>
      <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden p-3 gap-3 bg-slate-50 dark:bg-dark-bg">

        {/* Left Panel: Locations List as a Card */}
        <div className="w-[380px] flex-shrink-0 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-sm flex flex-col overflow-hidden">

          {/* Header / Search */}
          <div className="p-4 border-b border-slate-200 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/50 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-slate-800 dark:text-github-dark-text">Locations</h3>
              <button
                onClick={() => {
                  setIsEditingLocation(false);
                  setEditDraftCoords(null);
                  setShowCreateModal(true);
                }}
                className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
              >
                <Plus size={18} />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search offices..."
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Locations List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
            {locations.map(loc => (
              <div
                key={loc.location_id}
                onClick={() => setSelectedLocation(loc)}
                className={`p-3 rounded-lg border transition-all cursor-pointer group ${loc.is_active === 0
                  ? 'opacity-60'
                  : ''
                  } ${selectedLocation && selectedLocation.location_id === loc.location_id
                    ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-900/50 shadow-sm'
                    : 'bg-white dark:bg-dark-card border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h4 className={`font-semibold text-sm ${selectedLocation && selectedLocation.location_id === loc.location_id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-github-dark-text'}`}>{loc.location_name}</h4>
                  {loc.is_active === 1 ? (
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                      <span className="text-[10px] text-slate-400">Inactive</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-github-dark-muted line-clamp-1 mb-2">{loc.address}</p>
                <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-github-dark-muted">
                  <span className="flex items-center gap-1"><Crosshair size={10} /> {loc.radius}m</span>
                  <span className="flex items-center gap-1">
                    <Users size={10} />
                    {users.filter(u =>
                      u.work_locations?.some(
                        w => w.location_id === Number(loc.location_id)
                      )
                    ).length} Active
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center: Real Map View as a Card */}
        <div className="flex-1 relative bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-sm overflow-hidden">
          {(selectedLocation || showCreateModal) && (
            <MapContainer
              center={
                showCreateModal && newGeo.latitude && newGeo.longitude
                  ? [newGeo.latitude, newGeo.longitude]
                  : selectedLocation
                    ? [Number(selectedLocation.latitude), Number(selectedLocation.longitude)]
                    : [20, 78]
              }
              zoom={15}
              className="h-full w-full"
              attributionControl={false}
            >
              <TileLayer url={MAP_THEMES[activeTheme].url} />
              <div className="absolute top-4 right-4 z-[1001]">
                <div className="relative">
                  <button
                    onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                    className="flex items-center gap-2 bg-white dark:bg-github-dark-subtle text-slate-800 dark:text-github-dark-text px-4 py-2.5 rounded-xl shadow-lg border border-slate-200 dark:border-github-dark-border hover:border-indigo-500/50 transition-all group"
                  >
                    <Layers size={18} className="text-indigo-500 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-semibold">{MAP_THEMES[activeTheme].name}</span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isThemeMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isThemeMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIsThemeMenuOpen(false)} />
                      <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-20">
                        <div className="py-1">
                          {Object.entries(MAP_THEMES).map(([id, theme]) => (
                            <button
                              key={id}
                              onClick={() => {
                                setActiveTheme(id);
                                setIsThemeMenuOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors ${activeTheme === id
                                ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-bold'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                            >
                              <span>{theme.name}</span>
                              {activeTheme === id && <Check size={14} className="text-indigo-500" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {isEditingLocation && <EditMapClickHandler />}
              {showCreateModal && <MapClickHandler />}
              {!isEditingLocation && !showCreateModal && selectedLocation && <MapRecenter location={selectedLocation} />}

              {/* Create Mode Marker */}
              {showCreateModal && newGeo.latitude && newGeo.longitude && (
                <>
                  <Marker position={[newGeo.latitude, newGeo.longitude]} />
                  <Circle
                    center={[newGeo.latitude, newGeo.longitude]}
                    radius={newGeo.radius}
                    pathOptions={{ color: "#6366f1", fillColor: "#6366f1", fillOpacity: 0.25 }}
                  />
                </>
              )}

              {/* View/Edit Mode Marker */}
              {!showCreateModal && selectedLocation && (
                <>
                  <Marker
                    position={[
                      editDraftCoords ? editDraftCoords.latitude : Number(selectedLocation.latitude),
                      editDraftCoords ? editDraftCoords.longitude : Number(selectedLocation.longitude),
                    ]}
                  />
                  <Circle
                    center={[
                      editDraftCoords ? editDraftCoords.latitude : Number(selectedLocation.latitude),
                      editDraftCoords ? editDraftCoords.longitude : Number(selectedLocation.longitude),
                    ]}
                    radius={selectedLocation.radius}
                    pathOptions={{
                      color: "#6366f1",
                      fillColor: "#6366f1",
                      fillOpacity: 0.25,
                    }}
                  />
                </>
              )}
            </MapContainer>
          )}

          {selectedLocation && !isEditingLocation && !showCreateModal && (
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[92%] max-w-5xl bg-white/95 dark:bg-github-dark-subtle/90 backdrop-blur-xl border border-white/20 dark:border-github-dark-border/50 rounded-3xl p-8 flex flex-col md:flex-row gap-10 items-center justify-between text-slate-800 dark:text-github-dark-text z-[1000] shadow-[0_25px_70px_rgba(0,0,0,0.3)] dark:shadow-[0_30px_90px_rgba(0,0,0,0.6)] transition-all duration-300">

              {/* Location Info + Toggle */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-lg font-bold truncate">{selectedLocation.location_name}</h2>
                  <button
                    onClick={toggleLocationStatus}
                    className={`flex-shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${selectedLocation.is_active === 1 ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600"}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${selectedLocation.is_active === 1 ? "translate-x-6" : "translate-x-1"}`}
                    />
                  </button>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-300 flex items-center gap-1.5 truncate">
                  <MapPin size={14} className="flex-shrink-0" />
                  {selectedLocation.address}
                </p>
              </div>

              {/* Right side: static info + edit icon */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Crosshair size={14} className="text-indigo-500 dark:text-indigo-400" />
                  <span className="text-slate-600 dark:text-slate-300">Radius</span>
                  <span className="font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-600/20 dark:text-github-dark-text px-2 py-0.5 rounded text-xs">
                    {radiusDraft} m
                  </span>
                </div>
                <button
                  onClick={startEditing}
                  className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                  title="Edit location"
                >
                  <Edit2 size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Edit Mode: Expanded Form */}
          {selectedLocation && isEditingLocation && editDraftCoords && !showCreateModal && (
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[95%] max-w-6xl bg-white/98 dark:bg-github-dark-subtle/95 backdrop-blur-2xl border border-slate-200 dark:border-github-dark-border rounded-3xl p-8 text-slate-800 dark:text-github-dark-text z-[1000] shadow-[0_30px_100px_rgba(0,0,0,0.4)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Edit2 size={14} className="text-indigo-500 dark:text-indigo-400" />
                  Edit Geofence
                </h3>
                <span className="text-xs text-slate-500 dark:text-github-dark-muted animate-pulse">Click map to relocate pin</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Name */}
                <div>
                  <label className="text-xs text-slate-500 dark:text-github-dark-muted mb-1 block">Location Name</label>
                  <input
                    type="text"
                    value={editDraftCoords.location_name}
                    onChange={(e) => setEditDraftCoords(prev => ({ ...prev, location_name: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm text-slate-800 dark:text-github-dark-text placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    placeholder="Geofence Name"
                  />
                </div>

                {/* Latitude */}
                <div>
                  <label className="text-xs text-slate-500 dark:text-github-dark-muted mb-1 block">Latitude</label>
                  <input
                    type="text"
                    value={editDraftCoords.latitude ?? ''}
                    onChange={(e) => setEditDraftCoords(prev => ({ ...prev, latitude: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm text-slate-800 dark:text-github-dark-text placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    placeholder="Latitude"
                  />
                </div>

                {/* Longitude */}
                <div>
                  <label className="text-xs text-slate-500 dark:text-github-dark-muted mb-1 block">Longitude</label>
                  <input
                    type="text"
                    value={editDraftCoords.longitude ?? ''}
                    onChange={(e) => setEditDraftCoords(prev => ({ ...prev, longitude: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm text-slate-800 dark:text-github-dark-text placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    placeholder="Longitude"
                  />
                </div>

                {/* Radius */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-slate-500 dark:text-github-dark-muted">Radius</label>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{editDraftCoords.radius} m</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1000}
                    step={10}
                    value={editDraftCoords.radius}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setEditDraftCoords(prev => ({ ...prev, radius: val }));
                    }}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-500 mt-1"
                  />
                </div>
              </div>

              {/* Address preview */}
              {editDraftCoords.address && (
                <p className="text-xs text-slate-500 dark:text-github-dark-muted mt-3 flex items-center gap-1.5 truncate">
                  <MapPin size={12} className="flex-shrink-0" /> {editDraftCoords.address}
                </p>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200 dark:border-github-dark-border">
                <button
                  onClick={useMyLocationForEdit}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs bg-slate-100 dark:bg-github-dark-subtle text-slate-700 dark:text-github-dark-text hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-github-dark-border rounded-lg transition-colors"
                >
                  <Navigation size={12} /> Use my location
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-1.5 text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-github-dark-text hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEditedLocation}
                    className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Create Mode: Expanded Form */}
          {showCreateModal && (
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[95%] max-w-6xl bg-white/98 dark:bg-github-dark-subtle/95 backdrop-blur-2xl border border-slate-200 dark:border-github-dark-border rounded-3xl p-8 text-slate-800 dark:text-github-dark-text z-[1000] shadow-[0_30px_100px_rgba(0,0,0,0.4)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Plus size={14} className="text-indigo-500 dark:text-indigo-400" />
                  Create New Geofence
                </h3>
                <span className="text-xs text-slate-500 dark:text-github-dark-muted animate-pulse">Click map to drop pin</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Name */}
                <div>
                  <label className="text-xs text-slate-500 dark:text-github-dark-muted mb-1 block">Location Name</label>
                  <input
                    type="text"
                    value={newGeo.location_name}
                    onChange={(e) => setNewGeo({ ...newGeo, location_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm text-slate-800 dark:text-github-dark-text placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    placeholder="Geofence Name"
                  />
                </div>

                {/* Latitude */}
                <div>
                  <label className="text-xs text-slate-500 dark:text-github-dark-muted mb-1 block">Latitude</label>
                  <input
                    type="text"
                    value={newGeo.latitude ?? ''}
                    onChange={(e) => setNewGeo({ ...newGeo, latitude: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm text-slate-800 dark:text-github-dark-text placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    placeholder="Latitude"
                  />
                </div>

                {/* Longitude */}
                <div>
                  <label className="text-xs text-slate-500 dark:text-github-dark-muted mb-1 block">Longitude</label>
                  <input
                    type="text"
                    value={newGeo.longitude ?? ''}
                    onChange={(e) => setNewGeo({ ...newGeo, longitude: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-lg text-sm text-slate-800 dark:text-github-dark-text placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    placeholder="Longitude"
                  />
                </div>

                {/* Radius */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-slate-500 dark:text-github-dark-muted">Radius</label>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{newGeo.radius} m</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1000}
                    step={10}
                    value={newGeo.radius}
                    onChange={(e) => setNewGeo({ ...newGeo, radius: Number(e.target.value) })}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-500 mt-1"
                  />
                </div>
              </div>

              {/* Address preview */}
              {newGeo.address && (
                <p className="text-xs text-slate-500 dark:text-github-dark-muted mt-3 flex items-center gap-1.5 truncate">
                  <MapPin size={12} className="flex-shrink-0" /> {newGeo.address}
                </p>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200 dark:border-github-dark-border">
                <div className="flex gap-2">
                  <button
                    onClick={useMyLocation}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs bg-slate-100 dark:bg-github-dark-subtle text-slate-700 dark:text-github-dark-text hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-github-dark-border rounded-lg transition-colors"
                  >
                    <Navigation size={12} /> Use my location
                  </button>
                  <button
                    onClick={resetNewGeo}
                    className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-github-dark-subtle text-slate-700 dark:text-github-dark-text hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-github-dark-border rounded-lg transition-colors"
                  >
                    Reset
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      resetNewGeo();
                      setShowCreateModal(false);
                    }}
                    className="px-4 py-1.5 text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-github-dark-text hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateGeofence}
                    className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium"
                  >
                    Create Geofence
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Employee Assignment as a Card */}
        <div className="w-[380px] flex-shrink-0 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-github-dark-border bg-slate-50/50 dark:bg-github-dark-subtle/50">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-slate-800 dark:text-github-dark-text flex items-center gap-2">
                <Users size={18} /> Assigned Staff
              </h3>
            </div>
          </div>
          <div className="p-2 flex-1 overflow-y-auto space-y-1 custom-scrollbar">
            {loadingUsers && (
              <p className="text-sm text-slate-400 px-3">Loading users...</p>
            )}

            {!loadingUsers && users.map(user => {
              const selectedLocId = selectedLocation
                ? Number(selectedLocation.location_id)
                : null;

              const isAssigned =
                selectedLocId != null &&
                Array.isArray(user.work_locations) &&
                user.work_locations.some(
                  wl => wl.location_id === selectedLocId
                );
              return (
                <div
                  key={user.user_id}
                  className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-400 overflow-hidden">
                      {user.profile_image_url ? (
                        <img src={`${user.profile_image_url}?t=${avatarTimestamp}`} alt={user.user_name} className="w-full h-full object-cover" />
                      ) : (
                        user.user_name.charAt(0)
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-github-dark-text line-clamp-1">{user.user_name}</p>
                      <p className="text-xs text-slate-500 dark:text-github-dark-muted line-clamp-1">{user.desg_name}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleUserAssignment(user.user_id, isAssigned)}
                    className={`p-1.5 rounded-md transition-all ${isAssigned
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                      : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-200'
                      }`}
                  >
                    {isAssigned ? <Check size={16} /> : <Plus size={16} />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
};

export default GeoFencing;
