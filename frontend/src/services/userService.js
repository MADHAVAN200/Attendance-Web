const API_BASE = "/api"
/**
 * Get all users eligible for geofence assignment
 */
export const fetchWorkLocationUsers = async () => {
  const res = await fetch(`${API_BASE}/admin/users?workLocation=true`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch users");
  }

  return res.json();
};

/* ============================
   LOCATIONS (GEOFENCE)
   ============================ */

/**
 * Get all active work locations
 */
export const fetchLocations = async () => {
  const res = await fetch(`${API_BASE}/locations`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch locations");
  }

  return res.json();
};

/**
 * Create new geofence location
 */
export const createLocation = async (payload) => {
  const res = await fetch(`${API_BASE}/locations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("Failed to create location");
  }

  return res.json();
};

/**
 * Update geofence location
 */
export const updateLocation = async (locationId, payload) => {
  const res = await fetch(`${API_BASE}/locations/${locationId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("Failed to update location");
  }

  return res.json();
};

/**
 * Assign / Remove users from locations (bulk)
 */
export const updateLocationAssignments = async (assignments) => {
  const res = await fetch(`${API_BASE}/locations/assignments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ assignments }),
  });

  if (!res.ok) {
    throw new Error("Failed to update assignments");
  }

  return res.json();
};