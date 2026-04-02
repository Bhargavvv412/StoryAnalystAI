const fs = require("fs").promises;
const path = require("path");

const DB_DIR = path.join(__dirname, "../../.data");
const USERS_FILE = path.join(DB_DIR, "users.json");

// Ensure DB directory and file exist
async function initDb() {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    try {
      await fs.access(USERS_FILE);
    } catch {
      await fs.writeFile(USERS_FILE, JSON.stringify([]));
    }
  } catch (err) {
    console.error("Local DB Init Error:", err.message);
  }
}

// Read all users
async function getUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, "utf8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Write all users
async function saveUsers(users) {
  try {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error("Failed to save users:", err.message);
    throw err;
  }
}

// Find user by email
async function getUserByEmail(email) {
  const users = await getUsers();
  return users.find((u) => u.email === email);
}

// Create new user
async function createUser(userData) {
  const users = await getUsers();
  const newUser = {
    uid: "local-" + Date.now().toString() + "-" + Math.random().toString(36).substr(2, 9),
    ...userData,
    createdAt: new Date().toISOString(),
    plan: "free",
    usageCount: 0,
  };
  users.push(newUser);
  await saveUsers(users);
  return newUser;
}

// Immediately initialize DB on require
initDb();

module.exports = {
  getUsers,
  getUserByEmail,
  createUser,
};
