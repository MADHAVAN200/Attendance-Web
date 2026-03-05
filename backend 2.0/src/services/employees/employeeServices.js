import { attendanceDB } from '../../config/database.js';

export async function getAssignedLocations({ user_id }) {
    const assignedLocations = await attendanceDB("user_work_locations")
        .join("work_locations", "user_work_locations.location_id", "work_locations.location_id")
        .where("user_work_locations.user_id", user_id)
        .where("work_locations.is_active", true)
        .select(
            "work_locations.location_id",
            "work_locations.location_name",
            "work_locations.address",
            "work_locations.latitude",
            "work_locations.longitude",
            "work_locations.radius"
        );

    return assignedLocations;
}