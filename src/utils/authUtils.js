const USERS_KEY = 'learnify_users';

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
