
import { knexDB } from "../database.js";

// Haversine formula to calculate distance between two points in meters
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Radius of the earth in meters
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) *
        Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in meters
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

/**
 * Check if user is within any of the provided valid locations
 * @param {number} userLat
 * @param {number} userLng
 * @param {Array<{latitude: number, longitude: number, radius: number}>} validLocations
 * @returns {boolean}
 */
export function isWithinGeofence(userLat, userLng, validLocations) {
    if (!validLocations || validLocations.length === 0) return true;

    for (const loc of validLocations) {
        const distance = getDistanceFromLatLonInMeters(
            userLat,
            userLng,
            Number(loc.latitude),
            Number(loc.longitude)
        );

        // Check if distance is within radius (default 100m if not set)
        const allowedRadius = loc.radius || 100;
        if (distance <= allowedRadius) {
            return true;
        }
    }
    return false;
}

/**
 * Fetch user locations and verify if they are within geofence
 * @param {number} user_id
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<boolean>}
 */
export async function verifyUserGeofence(user_id, latitude, longitude) {
    const validLocations = await knexDB("user_work_locations")
        .join("work_locations", "user_work_locations.location_id", "work_locations.location_id")
        .where("user_work_locations.user_id", user_id)
        .where("work_locations.is_active", true)
        .select("work_locations.latitude", "work_locations.longitude", "work_locations.radius");

    // If user has NO assigned locations, we assume they are allowed everywhere (per user request)
    if (!validLocations || validLocations.length === 0) {
        return true;
    }

    return isWithinGeofence(latitude, longitude, validLocations);
}
