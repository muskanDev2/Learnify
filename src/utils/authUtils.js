const USERS_KEY = 'learnify_users';
const CURRENT_USER_KEY = 'learnify_current_user';

// Basic reusable validators for form fields.
export function validateEmail(email) {
  const value = email.trim();
  if (!value) return 'Email is required.';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) return 'Enter a valid email address.';
  return '';
}

export function validatePassword(password) {
  if (!password) return 'Password is required.';

  // Standard beginner-friendly complexity policy.
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
  if (!passwordRegex.test(password)) {
    return 'Use at least 8 characters with uppercase, lowercase, number, and special character.';
  }

  return '';
}

export function validateRequired(value, label) {
  if (!value.trim()) return `${label} is required.`;
  return '';
}

export function getStoredUsers() {
  const rawUsers = localStorage.getItem(USERS_KEY);
  if (!rawUsers) return [];

  try {
    const users = JSON.parse(rawUsers);
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

function setStoredUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function registerUser(userData) {
  // Prevent duplicate account creation by email.
  const users = getStoredUsers();
  const duplicateUser = users.find(
    (user) => user.email.toLowerCase() === userData.email.toLowerCase(),
  );

  if (duplicateUser) {
    return { ok: false, message: 'This email is already registered.' };
  }

  const userToSave = {
    name: userData.name.trim(),
    email: userData.email.trim().toLowerCase(),
    password: userData.password,
    role: userData.role,
  };

  setStoredUsers([...users, userToSave]);
  return { ok: true, message: 'Registration successful!' };
}

export function loginUser(loginData) {
  // Basic temporary auth: match user from localStorage list.
  const users = getStoredUsers();
  const matchedUser = users.find(
    (user) =>
      user.email.toLowerCase() === loginData.email.trim().toLowerCase() &&
      user.password === loginData.password,
  );

  if (!matchedUser) {
    return { ok: false, message: 'Invalid email or password.' };
  }

  return { ok: true, user: matchedUser, message: 'Login successful!' };
}

export function getCurrentUser() {
  const rawUser = localStorage.getItem(CURRENT_USER_KEY);
  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser);
  } catch {
    return null;
  }
}

export function setCurrentUser(user) {
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

export function updateCurrentUserProfile(profileUpdates) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return { ok: false, message: 'No active user found.' };
  }

  const updatedUser = { ...currentUser, ...profileUpdates };
  setCurrentUser(updatedUser);

  // Keep users list in sync using email as unique key.
  const users = getStoredUsers();
  const updatedUsers = users.map((user) =>
    user.email.toLowerCase() === updatedUser.email.toLowerCase() ? updatedUser : user,
  );
  setStoredUsers(updatedUsers);

  return { ok: true, user: updatedUser };
}
