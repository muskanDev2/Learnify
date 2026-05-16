import { useMemo, useState } from 'react';
import { getCurrentUser, getStoredUsers, isAdmin } from '../utils/authUtils';

const USERS_KEY = 'learnify_users';

function normalizeUsers(users) {
  return (Array.isArray(users) ? users : []).map((user) => ({
    ...user,
    active: user.active !== false,
  }));
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export default function AdminUsersPanel() {
  const currentUser = getCurrentUser();
  const currentEmail = (currentUser?.email || '').toLowerCase();

  const [users, setUsers] = useState(() => normalizeUsers(getStoredUsers()));
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('new'); // new | old | name
  const [categoryFilter, setCategoryFilter] = useState('all'); // all | admin | instructor | student
  const [message, setMessage] = useState({ type: '', text: '' });
  const [selectedProfileUser, setSelectedProfileUser] = useState(null);
  const [isProfileEditMode, setIsProfileEditMode] = useState(false);
  const [pendingRoleChange, setPendingRoleChange] = useState(null);
  const [showProfileSaveConfirm, setShowProfileSaveConfirm] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    role: 'student',
    active: true,
    gender: '',
    phone: '',
    address: '',
    country: '',
    profileImage: '',
  });

  const filteredUsers = useMemo(() => {
    const withPosition = users.map((user, index) => ({ ...user, __position: index }));

    const filteredByRole = withPosition.filter((user) => {
      if (categoryFilter === 'all') return true;
      return (user.role || '').toLowerCase() === categoryFilter;
    });

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const searched = filteredByRole.filter((user) => {
      if (!normalizedSearch) return true;
      return (
        (user.name || '').toLowerCase().includes(normalizedSearch) ||
        (user.email || '').toLowerCase().includes(normalizedSearch)
      );
    });

    if (sortBy === 'name') {
      return [...searched].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    if (sortBy === 'old') {
      return [...searched].sort((a, b) => a.__position - b.__position);
    }

    return [...searched].sort((a, b) => b.__position - a.__position);
  }, [categoryFilter, searchTerm, sortBy, users]);

  function persistAndSetUsers(nextUsers, successText) {
    setUsers(nextUsers);
    saveUsers(nextUsers);
    setMessage({ type: 'success', text: successText });
  }

  function blockAction(text) {
    setMessage({ type: 'error', text });
  }

  function applyRoleChange(targetEmail, nextRole) {
    const emailKey = (targetEmail || '').toLowerCase();
    const roleKey = String(nextRole || '').toLowerCase();
    const targetUser = users.find((user) => (user.email || '').toLowerCase() === emailKey);
    if (!targetUser) return;

    const targetIsAdmin = isAdmin(targetUser);
    const targetIsCurrentAdmin =
      targetIsAdmin && emailKey === currentEmail && isAdmin(currentUser);

    if (targetIsCurrentAdmin && roleKey !== 'admin') {
      blockAction('You cannot demote your own admin account.');
      return;
    }

    if (targetIsAdmin && emailKey !== currentEmail) {
      blockAction('You cannot change another admin account.');
      return;
    }

    if ((targetUser.role || '').toLowerCase() === roleKey) return;

    if (targetIsAdmin && roleKey !== 'admin') {
      const adminCount = users.filter((user) => isAdmin(user)).length;
      if (adminCount <= 1) {
        blockAction('At least one admin must always remain in the system.');
        return;
      }
    }

    const nextUsers = users.map((user) =>
      (user.email || '').toLowerCase() === emailKey ? { ...user, role: roleKey } : user,
    );
    persistAndSetUsers(nextUsers, 'User role updated successfully.');
  }

  function handleRoleChangeRequest(targetEmail, nextRole) {
    setPendingRoleChange({ targetEmail, nextRole });
  }

  function confirmRoleChange() {
    if (!pendingRoleChange) return;
    applyRoleChange(pendingRoleChange.targetEmail, pendingRoleChange.nextRole);
    setPendingRoleChange(null);
  }

  function toggleUserActiveState(targetEmail, shouldActivate) {
    const emailKey = (targetEmail || '').toLowerCase();
    const targetUser = users.find((user) => (user.email || '').toLowerCase() === emailKey);
    if (!targetUser) return;

    if (isAdmin(targetUser)) {
      blockAction('Admin accounts cannot be deactivated from this panel.');
      return;
    }

    const nextUsers = users.map((user) =>
      (user.email || '').toLowerCase() === emailKey
        ? { ...user, active: shouldActivate }
        : user,
    );
    persistAndSetUsers(
      nextUsers,
      shouldActivate ? 'User activated successfully.' : 'User deactivated successfully.',
    );
  }

  function deleteUser(targetEmail) {
    const emailKey = (targetEmail || '').toLowerCase();
    const targetUser = users.find((user) => (user.email || '').toLowerCase() === emailKey);
    if (!targetUser) return;

    if (isAdmin(targetUser)) {
      blockAction('Admin accounts cannot be deleted from this panel.');
      return;
    }

    const nextUsers = users.filter((user) => (user.email || '').toLowerCase() !== emailKey);
    persistAndSetUsers(nextUsers, 'User deleted successfully.');
  }

  function openProfileModal(user) {
    setSelectedProfileUser(user);
    setIsProfileEditMode(false);
    setProfileForm({
      name: user.name || '',
      email: user.email || '',
      role: (user.role || 'student').toLowerCase(),
      active: user.active !== false,
      gender: user.gender || '',
      phone: user.phone || '',
      address: user.address || '',
      country: user.country || '',
      profileImage: user.profileImage || '',
    });
  }

  function closeProfileModal() {
    setSelectedProfileUser(null);
    setIsProfileEditMode(false);
    setShowProfileSaveConfirm(false);
  }

  function handleProfileFormChange(event) {
    const { name, value, type, checked } = event.target;
    setProfileForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  function handleProfileImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setProfileForm((prev) => ({ ...prev, profileImage: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
  }

  function saveProfileEdits() {
    if (!selectedProfileUser) return;
    const selectedEmail = (selectedProfileUser.email || '').toLowerCase();
    const selectedIsAdmin = isAdmin(selectedProfileUser);
    if (selectedIsAdmin) {
      blockAction('Admin profile fields are read-only in this modal.');
      return;
    }

    const nextEmail = (profileForm.email || '').trim().toLowerCase();
    if (!nextEmail) {
      blockAction('Email is required.');
      return;
    }

    const duplicateEmail = users.some(
      (user) =>
        (user.email || '').toLowerCase() === nextEmail &&
        (user.email || '').toLowerCase() !== selectedEmail,
    );
    if (duplicateEmail) {
      blockAction('Another user already uses this email.');
      return;
    }

    const nextUsers = users.map((user) => {
      const userEmail = (user.email || '').toLowerCase();
      if (userEmail !== selectedEmail) return user;
      return {
        ...user,
        name: profileForm.name.trim(),
        email: nextEmail,
        role: (profileForm.role || 'student').toLowerCase(),
        active: Boolean(profileForm.active),
        gender: profileForm.gender,
        phone: profileForm.phone,
        address: profileForm.address,
        country: profileForm.country,
        profileImage: profileForm.profileImage || '',
      };
    });

    setUsers(nextUsers);
    saveUsers(nextUsers);

    const updatedSelected =
      nextUsers.find((user) => (user.email || '').toLowerCase() === nextEmail) || null;
    setSelectedProfileUser(updatedSelected);
    setIsProfileEditMode(false);
    setMessage({ type: 'success', text: 'Profile updated successfully.' });
  }

  return (
    <div className="dashboardPanel">
      <h3>Users</h3>
      <p>List of all users with role management controls for non-admin accounts.</p>

      <div className="myCoursesFilters">
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          aria-label="Filter users by role"
        >
          <option value="all">All</option>
          <option value="admin">Admin</option>
          <option value="instructor">Instructor</option>
          <option value="student">Student</option>
        </select>

        <input
          type="search"
          placeholder="Search by name or email"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          aria-label="Search users"
        />

        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
          aria-label="Sort users"
        >
          <option value="new">Sort by new</option>
          <option value="old">Sort by old</option>
          <option value="name">Sort by name</option>
        </select>
      </div>

      {message.text && (
        <p
          className={message.type === 'success' ? 'adminActionSuccess' : 'adminActionError'}
          role="status"
        >
          {message.text}
        </p>
      )}

      <section className="adminUsersTable adminUsersTableWide">
        <div className="adminUsersTableHeader adminUsersTableHeaderWide">
          <span>Designation</span>
          <span>Name</span>
          <span>Email</span>
          <span>Status</span>
          <span>Role</span>
          <span>Actions</span>
        </div>
        {filteredUsers.length ? (
          filteredUsers.map((user) => {
            const roleKey = (user.role || 'student').toLowerCase();
            const userIsAdmin = isAdmin(user);
            const isCurrentAdminUser =
              userIsAdmin &&
              (user.email || '').toLowerCase() === currentEmail &&
              isAdmin(currentUser);

            return (
              <div key={user.email} className="adminUsersTableRow adminUsersTableRowWide">
                <span>{roleKey}</span>
                <span>{user.name || '-'}</span>
                <span>{user.email || '-'}</span>
                <span>{user.active === false ? 'Inactive' : 'Active'}</span>
                <span>
                  <select
                    className="adminRoleSelect"
                    value={roleKey}
                    onChange={(event) =>
                      handleRoleChangeRequest(user.email, event.target.value)
                    }
                    disabled={userIsAdmin}
                    aria-label={`Update role for ${user.name || user.email}`}
                  >
                    <option value="admin">Admin</option>
                    <option value="instructor">Instructor</option>
                    <option value="student">Student</option>
                  </select>
                  {isCurrentAdminUser && (
                    <small className="adminInlineHint">Self-demotion blocked</small>
                  )}
                  {userIsAdmin && !isCurrentAdminUser && (
                    <small className="adminInlineHint">Other admin protected</small>
                  )}
                </span>
                <span className="adminUsersActions">
                  <button
                    type="button"
                    className="heroButton heroButtonSecondary"
                    onClick={() => openProfileModal(user)}
                  >
                    View
                  </button>

                  {!userIsAdmin && (
                    <>
                      {user.active === false ? (
                        <button
                          type="button"
                          className="profilePrimaryButton"
                          onClick={() => toggleUserActiveState(user.email, true)}
                        >
                          Activate
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="heroButton heroButtonSecondary"
                          onClick={() => toggleUserActiveState(user.email, false)}
                        >
                          Deactivate
                        </button>
                      )}
                      <button
                        type="button"
                        className="profileDangerButton"
                        onClick={() => deleteUser(user.email)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </span>
              </div>
            );
          })
        ) : (
          <div className="adminUsersTableRow adminUsersTableRowWide">
            <span>No users found.</span>
            <span>-</span>
            <span>-</span>
            <span>-</span>
            <span>-</span>
            <span>-</span>
          </div>
        )}
      </section>

      {selectedProfileUser && (
        <div className="lightboxOverlay" role="dialog" aria-modal="true" aria-labelledby="user-profile-title">
          <div className="lightboxCard adminProfileModal">
            <button
              type="button"
              className="adminModalCloseButton"
              onClick={closeProfileModal}
              aria-label="Close profile details"
            >
              ×
            </button>
            <h3 id="user-profile-title">User Profile Details</h3>
            <div className="adminProfileTop">
              {profileForm.profileImage ? (
                <img src={profileForm.profileImage} alt="Profile" className="adminProfileImage" />
              ) : (
                <div className="adminProfileInitials">
                  {(profileForm.name || selectedProfileUser.name || 'U').trim().charAt(0).toUpperCase()}
                </div>
              )}
              {!isAdmin(selectedProfileUser) && (
                <div className="adminProfileTopActions">
                  {isProfileEditMode ? (
                    <>
                      <button
                        type="button"
                        className="profilePrimaryButton"
                        onClick={() => setShowProfileSaveConfirm(true)}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="heroButton heroButtonSecondary"
                        onClick={() => {
                          setIsProfileEditMode(false);
                          setShowProfileSaveConfirm(false);
                          openProfileModal(selectedProfileUser);
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="profilePrimaryButton"
                      onClick={() => setIsProfileEditMode(true)}
                    >
                      Edit Profile
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="adminProfileGrid">
              <article>
                <h4>Name</h4>
                {isProfileEditMode && !isAdmin(selectedProfileUser) ? (
                  <input name="name" value={profileForm.name} onChange={handleProfileFormChange} />
                ) : (
                  <p>{selectedProfileUser.name || '-'}</p>
                )}
              </article>
              <article>
                <h4>Email</h4>
                {isProfileEditMode && !isAdmin(selectedProfileUser) ? (
                  <input name="email" value={profileForm.email} onChange={handleProfileFormChange} />
                ) : (
                  <p>{selectedProfileUser.email || '-'}</p>
                )}
              </article>
              <article>
                <h4>Role</h4>
                {isProfileEditMode && !isAdmin(selectedProfileUser) ? (
                  <select name="role" value={profileForm.role} onChange={handleProfileFormChange}>
                    <option value="student">student</option>
                    <option value="instructor">instructor</option>
                    <option value="admin">admin</option>
                  </select>
                ) : (
                  <p>{(selectedProfileUser.role || 'student').toLowerCase()}</p>
                )}
              </article>
              <article>
                <h4>Status</h4>
                {isProfileEditMode && !isAdmin(selectedProfileUser) ? (
                  <label className="assignmentCheckboxRow">
                    <input
                      type="checkbox"
                      name="active"
                      checked={Boolean(profileForm.active)}
                      onChange={handleProfileFormChange}
                    />
                    <span>{profileForm.active ? 'Active' : 'Inactive'}</span>
                  </label>
                ) : (
                  <p>{selectedProfileUser.active === false ? 'Inactive' : 'Active'}</p>
                )}
              </article>
              <article>
                <h4>Gender</h4>
                {isProfileEditMode && !isAdmin(selectedProfileUser) ? (
                  <input name="gender" value={profileForm.gender} onChange={handleProfileFormChange} />
                ) : (
                  <p>{selectedProfileUser.gender || '-'}</p>
                )}
              </article>
              <article>
                <h4>Phone</h4>
                {isProfileEditMode && !isAdmin(selectedProfileUser) ? (
                  <input name="phone" value={profileForm.phone} onChange={handleProfileFormChange} />
                ) : (
                  <p>{selectedProfileUser.phone || '-'}</p>
                )}
              </article>
              <article>
                <h4>Address</h4>
                {isProfileEditMode && !isAdmin(selectedProfileUser) ? (
                  <input name="address" value={profileForm.address} onChange={handleProfileFormChange} />
                ) : (
                  <p>{selectedProfileUser.address || '-'}</p>
                )}
              </article>
              <article>
                <h4>Country</h4>
                {isProfileEditMode && !isAdmin(selectedProfileUser) ? (
                  <input name="country" value={profileForm.country} onChange={handleProfileFormChange} />
                ) : (
                  <p>{selectedProfileUser.country || '-'}</p>
                )}
              </article>
              <article>
                <h4>Profile Picture</h4>
                {isProfileEditMode && !isAdmin(selectedProfileUser) ? (
                  <input type="file" accept="image/*" onChange={handleProfileImageChange} />
                ) : (
                  <p>{selectedProfileUser.profileImage ? 'Uploaded' : 'Not uploaded'}</p>
                )}
              </article>
            </div>
          </div>
        </div>
      )}

      {pendingRoleChange && (
        <div className="lightboxOverlay" role="dialog" aria-modal="true" aria-labelledby="admin-role-confirm-title">
          <div className="lightboxCard adminConfirmModal">
            <h3 id="admin-role-confirm-title">Confirm Role Change</h3>
            <p className="authSubtext">
              Are you sure you want to change this user&apos;s role?
            </p>
            <div className="profileModalActions">
              <button type="button" className="profilePrimaryButton" onClick={confirmRoleChange}>
                Yes, Confirm
              </button>
              <button
                type="button"
                className="heroButton heroButtonSecondary"
                onClick={() => setPendingRoleChange(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showProfileSaveConfirm && (
        <div className="lightboxOverlay" role="dialog" aria-modal="true" aria-labelledby="admin-profile-save-confirm-title">
          <div className="lightboxCard adminConfirmModal">
            <h3 id="admin-profile-save-confirm-title">Confirm Profile Update</h3>
            <p className="authSubtext">
              Do you want to save these profile changes?
            </p>
            <div className="profileModalActions">
              <button
                type="button"
                className="profilePrimaryButton"
                onClick={() => {
                  saveProfileEdits();
                  setShowProfileSaveConfirm(false);
                }}
              >
                Yes, Save
              </button>
              <button
                type="button"
                className="heroButton heroButtonSecondary"
                onClick={() => setShowProfileSaveConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
