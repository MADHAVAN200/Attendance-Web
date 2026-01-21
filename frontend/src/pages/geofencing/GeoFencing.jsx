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
import { Map, MapPin, Plus, Search, Navigation, Users, Settings, ToggleLeft, ToggleRight, Crosshair, MoreVertical, Check } from 'lucide-react';

const GeoFencing = () => {
  // --- STATE ---
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [radiusDraft, setRadiusDraft] = useState(100);

  const [showCreateModal, setShowCreateModal] = useState(false);

  // Debounce state for radius save
  const [radiusSaveTimer, setRadiusSaveTimer] = useState(null);

  const [newGeo, setNewGeo] = useState({
    location_name: "",
    address: "",
    latitude: null,
    longitude: null,
    radius: 100,
  });

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
        console.log("RAW users from API 👇");
        console.log(JSON.stringify(data.users, null, 2));

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
    } catch (err) {
      console.error("Assignment update failed", err);
      alert("Failed to update assignment. Please retry.");

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
    <DashboardLayout title="Geo-Fencing">
      <div className="flex h-[calc(100vh-140px)] gap-6">

        {/* Left Panel: Locations List */}
        <div className="w-80 flex-shrink-0 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">

          {/* Header / Search */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-slate-800 dark:text-white">Locations</h3>
              <button
                onClick={() => setShowCreateModal(true)}
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
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* 
                    NOTE:
                    Inactive locations are still displayed and selectable.
                    is_active only affects time-in validation, NOT visibility.
                    */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
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
                  <h4 className={`font-semibold text-sm ${selectedLocation && selectedLocation.location_id === loc.location_id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200'}`}>{loc.location_name}</h4>
                  {loc.is_active === 1 ? (
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                      <span className="text-[10px] text-slate-400">Inactive</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mb-2">{loc.address}</p>
                <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
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

        {/* Center: Real Map View */}
        <div className="flex-1 relative bg-slate-100 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {selectedLocation && (
            <MapContainer
              center={[
                Number(selectedLocation.latitude),
                Number(selectedLocation.longitude),
              ]}
              zoom={15}
              className="h-full w-full rounded-xl"
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              <MapRecenter location={selectedLocation} />
              <Marker
                position={[
                  Number(selectedLocation.latitude),
                  Number(selectedLocation.longitude),
                ]}
              />
              <Circle
                center={[
                  Number(selectedLocation.latitude),
                  Number(selectedLocation.longitude),
                ]}
                radius={selectedLocation.radius}
                pathOptions={{
                  color: "#6366f1",
                  fillColor: "#6366f1",
                  fillOpacity: 0.25,
                }}
              />
            </MapContainer>
          )}

          {selectedLocation && (
            <div className="absolute bottom-6 left-6 right-6 bg-slate-900/80 backdrop-blur-md border border-slate-700 rounded-xl p-5 flex flex-col md:flex-row gap-6 items-center justify-between text-white z-[1000]">

              {/* Location Info + Toggle */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-lg font-bold">{selectedLocation.location_name}</h2>
                  <button
                    onClick={toggleLocationStatus}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${selectedLocation.is_active === 1
                      ? "bg-indigo-600"
                      : "bg-slate-600"
                      }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${selectedLocation.is_active === 1
                        ? "translate-x-6"
                        : "translate-x-1"
                        }`}
                    />
                  </button>
                </div>

                <p className="text-sm text-slate-300 flex items-center gap-1.5">
                  <MapPin size={14} /> {selectedLocation.address}
                </p>
              </div>

              {/* Radius Slider */}
              <div className="w-full md:w-72">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Crosshair size={14} className="text-indigo-400" />
                    Geofence Radius
                  </label>
                  <span className="text-xs font-bold bg-indigo-600/20 px-2 py-0.5 rounded">
                    {radiusDraft} m
                  </span>
                </div>

                <input
                  type="range"
                  min={0}
                  max={1000}
                  step={10}
                  value={radiusDraft}
                  onChange={(e) => handleRadiusChange(Number(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Employee Assignment */}
        <div className="w-80 flex-shrink-0 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <Users size={18} /> Assigned Staff
            </h3>
          </div>
          <div className="p-2 flex-1 overflow-y-auto space-y-1">
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
                        <img src={user.profile_image_url} alt={user.user_name} className="w-full h-full object-cover" />
                      ) : (
                        user.user_name.charAt(0)
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-white">{user.user_name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{user.desg_name}</p>
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
      {/* Create Geofence Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[2000] bg-black/60 flex items-center justify-center">
          <div className="bg-slate-900 text-white w-full max-w-5xl rounded-xl border border-slate-700 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* LEFT: Form */}
              <div className="p-6 space-y-5">
                <h2 className="text-xl font-bold">Create New Geofence</h2>

                <input
                  placeholder="Geofence Name"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded"
                  value={newGeo.location_name}
                  onChange={(e) =>
                    setNewGeo({ ...newGeo, location_name: e.target.value })
                  }
                />

                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder="Latitude"
                    className="px-4 py-2 bg-slate-800 border border-slate-700 rounded"
                    value={newGeo.latitude ?? ""}
                    onChange={(e) =>
                      setNewGeo({ ...newGeo, latitude: Number(e.target.value) })
                    }
                  />
                  <input
                    placeholder="Longitude"
                    className="px-4 py-2 bg-slate-800 border border-slate-700 rounded"
                    value={newGeo.longitude ?? ""}
                    onChange={(e) =>
                      setNewGeo({ ...newGeo, longitude: Number(e.target.value) })
                    }
                  />
                </div>

                {newGeo.address && (
                  <div className="text-xs text-slate-400 bg-slate-800 border border-slate-700 rounded px-3 py-2">
                    📍 {newGeo.address}
                  </div>
                )}

                <div>
                  <label className="text-sm">Radius (meters)</label>
                  <input
                    type="range"
                    min={0}
                    max={1000}
                    step={10}
                    value={newGeo.radius}
                    onChange={(e) =>
                      setNewGeo({ ...newGeo, radius: Number(e.target.value) })
                    }
                    className="w-full accent-indigo-500"
                  />
                  <p className="text-xs text-slate-400">{newGeo.radius} m</p>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={useMyLocation}
                      className="px-3 py-2 rounded-md border border-gray-600 bg-gray-700 text-white hover:bg-gray-600 transition-colors text-sm flex-1"
                    >
                      Use my location
                    </button>

                    <button
                      onClick={resetNewGeo}
                      className="px-3 py-2 rounded-md border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors text-sm"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
              {/* RIGHT: Map */}
              <div className="h-[520px] border-l border-slate-700">
                <MapContainer
                  center={
                    newGeo.latitude && newGeo.longitude
                      ? [newGeo.latitude, newGeo.longitude]
                      : [20, 78]
                  }
                  zoom={5}
                  className="h-full w-full"
                >
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                  {mapPickEnabled && <MapClickHandler />}

                  {newGeo.latitude && newGeo.longitude && (
                    <>
                      <Marker position={[newGeo.latitude, newGeo.longitude]} />
                      <Circle
                        center={[newGeo.latitude, newGeo.longitude]}
                        radius={newGeo.radius}
                        pathOptions={{ color: "#6366f1", fillOpacity: 0.25 }}
                      />
                    </>
                  )}
                </MapContainer>
              </div>
            </div> {/* end grid */}
            <div className="flex justify-end gap-3 p-4 border-t border-slate-700 bg-slate-900">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGeofence}
                className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700"
              >
                Create GeoFence
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default GeoFencing;