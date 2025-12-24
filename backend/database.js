import mysql from 'mysql2';
import Fuse from "fuse.js";
import knex from 'knex';
import './config.js';

// Create a MySQL pool with connection details
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
}).promise();


export const knexDB = knex({
  client: 'mysql2',
  connection: {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  },
  pool: { min: 2, max: 10 },
});



// #region 🛠️ HELP FUNCTIONS ─────────────────────────────────────────────

function safeParse(jsonField) {
  if (!jsonField) return {};
  if (typeof jsonField === "object") return jsonField;
  try {
    return JSON.parse(jsonField);
  } catch (err) {
    console.error("❌ Failed to parse JSON field:", jsonField);
    return {};
  }
}

// #endregion

// #region 🧑‍💼 USERS ─────────────────────────────────────────────

export const ALLOWED_UPDATE_FIELDS = new Set([
  "user_name",
  "user_password",
  "email",
  "phone_no",
  "title_id",
]);

// Function to fetch User by user_name
// Function to fetch User by login (email or phone)
export async function r_fetchUserByLogin(loginInput) {
  const query = `SELECT 
      u.user_id, 
      u.user_name, 
      u.user_password, 
      u.email, 
      u.phone_no,
      u.org_id,
      dp.dept_name,
      dg.desg_name,
      sh.shift_name,
      sh.shift_id
    FROM users u
    LEFT JOIN departments dp ON u.dept_id = dp.dept_id
    LEFT JOIN designations dg ON u.desg_id = dg.desg_id
    LEFT JOIN shifts sh ON u.shift_id = sh.shift_id
    WHERE u.email = ? OR u.phone_no = ?;
    `;
  try {
    const [rows] = await pool.query(query, [loginInput, loginInput]);
    return rows[0] || null;
  } catch (error) {
    console.error("Error fetching user by login:", error);
    throw error;
  }
}

// Legacy function (kept for compatibility or internal checks)
export async function r_fetchUserByName(name) {
  const query = `SELECT * FROM users WHERE user_name = ?`;
  try {
    const [rows] = await pool.query(query, [name]);
    return rows[0] || null;
  } catch (error) { throw error; }
}


// Function to fetch all users
export async function getAllUsers(org_id) {
  const query = `SELECT 
      u.user_id, 
      u.user_name,
      u.email,
      u.phone_no, 
      dp.dept_name,
      dg.desg_name
    FROM users u
    LEFT JOIN departments dp ON u.dept_id = dp.dept_id
    LEFT JOIN designations dg ON u.desg_id = dg.desg_id
    WHERE u.org_id = ?`;

  try {
    const [Rows] = await pool.query(query, [org_id || 1]); // Default to 1 if not passed
    return { ok: true, users: Rows };
  } catch (error) {
    console.error('Error fetching all users:', error);
    return { ok: false, message: 'Database error' };
  }
}


// Function to fetch User by email
export async function r_fetchUserByEmail(email) {
  const query = "SELECT * FROM users WHERE email = ?"
  try {
    const [row] = await pool.query(query, [email]);
    return row[0] || null;
  } catch (error) {
    console.error("Error fetching user by name:", error);
    throw error;
  }
}

// Function to update user password
export async function updateUserPassword(email, hashedPassword) {
  const query = "UPDATE users SET user_password = ? WHERE email = ?";
  try {
    const [result] = await pool.query(query, [hashedPassword, email]);
    return result.affectedRows > 0;
  } catch (error) {
    console.error("Error updating user password:", error);
    throw error;
  }
}

export async function checkUserExists(email, phone) {
  const [rows] = await pool.query(
    "SELECT user_id FROM users WHERE email = ? OR phone_no = ? LIMIT 1",
    [email, phone]
  );
  return rows.length > 0;
}

export async function insertUser(username, email, hashedPassword, phone, org_id = 1) {
  try {
    // Default to org_id = 1 if not provided. Assumes Organization 1 exists.
    const userInsertQuery = `INSERT INTO users (user_name, email, user_password, phone_no, org_id) VALUES (?, ?, ?, ?, ?)`;
    const [userResult] = await pool.query(userInsertQuery, [username, email, hashedPassword, phone, org_id]);
    return !!userResult.insertId;
  } catch (error) {
    console.error('Error inserting user:', error);
    return false;
  }
}

export async function updateUserById(user_id, updates) {
  const fields = [];
  const values = [];

  for (const key in updates) {
    if (ALLOWED_UPDATE_FIELDS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }

  if (fields.length === 0) {
    return { ok: false, message: "No valid fields to update" };
  }

  values.push(user_id);
  const query = `UPDATE users SET ${fields.join(", ")} WHERE user_id = ?`;

  try {
    const [result] = await pool.query(query, values);
    if (result.affectedRows === 0) {
      return { ok: false, message: "User not found" };
    }
    return { ok: true };
  } catch (error) {
    console.error("Error updating user:", error);
    return { ok: false, message: "Database error" };
  }
}

export async function updateUserByMail(email, updates) {
  const fields = [];
  const values = [];

  for (const key in updates) {
    if (ALLOWED_UPDATE_FIELDS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }

  if (fields.length === 0) {
    return { ok: false, message: "No valid fields to update" };
  }

  values.push(email);
  const query = `UPDATE users SET ${fields.join(", ")} WHERE email = ?`;

  try {
    const [result] = await pool.query(query, values);
    if (result.affectedRows === 0) {
      return { ok: false, message: "User not found" };
    }
    return { ok: true };
  } catch (error) {
    console.error("Error updating user:", error);
    return { ok: false, message: "Database error" };
  }
}

export async function deleteUserById(user_id) {
  const query = 'DELETE FROM users WHERE user_id = ?';
  try {
    const [result] = await pool.query(query, [user_id]);
    if (result.affectedRows === 0) {
      return { ok: false, message: "User not found" };
    }
    return { ok: true };
  } catch (error) {
    console.error("Error deleting user:", error);
    return { ok: false, message: "Database error" };
  }
}

// #region 📊 ADMIN / SETUP HELPERS ─────────────────────────────────────────────

export async function getDepartments(org_id) {
  const query = `SELECT dept_id, dept_name FROM departments WHERE org_id = ? OR is_default = 1`;
  try {
    const [rows] = await pool.query(query, [org_id]);
    return { ok: true, departments: rows };
  } catch (error) {
    console.error('Error fetching departments:', error);
    return { ok: false, message: 'Database error' };
  }
}

export async function getDesignations(org_id) {
  const query = `SELECT desg_id, desg_name FROM designations WHERE org_id = ? OR is_default = 1`;
  try {
    const [rows] = await pool.query(query, [org_id]);
    return { ok: true, designations: rows };
  } catch (error) {
    console.error('Error fetching designations:', error);
    return { ok: false, message: 'Database error' };
  }
}

export async function getShifts(org_id) {
  const query = `SELECT shift_id, shift_name, shift_type, start_time, end_time FROM shifts WHERE org_id = ?`;
  try {
    const [rows] = await pool.query(query, [org_id]);
    return { ok: true, shifts: rows };
  } catch (error) {
    console.error('Error fetching shifts:', error);
    return { ok: false, message: 'Database error' };
  }
}

export async function getWorkLocations(org_id) {
  const query = `SELECT location_id, location_name, latitude, longitude, radius FROM work_locations WHERE org_id = ? AND is_active = 1`;
  try {
    const [rows] = await pool.query(query, [org_id]);
    return { ok: true, locations: rows };
  } catch (error) {
    console.error('Error fetching locations:', error);
    return { ok: false, message: 'Database error' };
  }
}

// #endregion
