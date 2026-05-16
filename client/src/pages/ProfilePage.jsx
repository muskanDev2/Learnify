import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, updateCurrentUserProfile } from '../utils/authUtils';

const COUNTRY_OPTIONS = ['Pakistan', 'India', 'United Arab Emirates', 'Saudi Arabia', 'United Kingdom', 'United States'];

function buildProfileData(user) {
  return {
    name: user?.name || 'Learner',
    email: user?.email || '',
    role: user?.role || 'Student',
    phone: user?.phone || '',
    address: user?.address || '',
    country: user?.country || '',
    gender: user?.gender || '',
    profileImage: user?.profileImage || '',
    countryLocked: Boolean(user?.countryLocked),
    genderLocked: Boolean(user?.genderLocked),
  };
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const currentUser = useMemo(() => getCurrentUser(), []);
  const [profileData, setProfileData] = useState(() => buildProfileData(currentUser));
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isPhotoMenuOpen, setIsPhotoMenuOpen] = useState(false);
  const [isPhotoPreviewOpen, setIsPhotoPreviewOpen] = useState(false);
  const [editForm, setEditForm] = useState(() => buildProfileData(currentUser));
  const [toastMessage, setToastMessage] = useState('');
  const photoMenuRef = useRef(null);
  const deleteCancelRef = useRef(null);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (photoMenuRef.current && !photoMenuRef.current.contains(event.target)) {
        setIsPhotoMenuOpen(false);
      }
    }

    if (isPhotoMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }

    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isPhotoMenuOpen]);

  useEffect(() => {
    if (isDeleteConfirmOpen && deleteCancelRef.current) {
      deleteCancelRef.current.focus();
    }
  }, [isDeleteConfirmOpen]);

  function showSuccessToast(message) {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage('');
    }, 5000);
  }

  function openEditModal() {
    setEditForm(profileData);
    setIsEditOpen(true);
  }

  function handleCancelEdit() {
    setEditForm(profileData);
    setIsEditOpen(false);
  }

  function handleInputChange(event) {
    const { name, value } = event.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleProfilePictureUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const imageData = reader.result;
      setProfileData((prev) => ({ ...prev, profileImage: imageData }));
      const result = updateCurrentUserProfile({ profileImage: imageData });
      if (result.ok) {
        window.dispatchEvent(new Event('learnify-user-updated'));
        showSuccessToast('Successfully updated!');
        setIsPhotoMenuOpen(false);
      }
    };
    reader.readAsDataURL(file);
  }

  function handleConfirmEdit() {
    const updatedProfile = {
      phone: editForm.phone,
      address: editForm.address,
      gender: editForm.gender,
      country: editForm.country,
      // Lock these after first confirmation as requested.
      genderLocked: true,
      countryLocked: true,
    };

    const result = updateCurrentUserProfile(updatedProfile);
    if (!result.ok) {
      return;
    }

    const mergedProfile = { ...profileData, ...updatedProfile };
    setProfileData(mergedProfile);
    setEditForm(mergedProfile);
    setIsEditOpen(false);
    window.dispatchEvent(new Event('learnify-user-updated'));
    showSuccessToast('Successfully updated!');
  }

  function handleDeactivateAccount() {
    localStorage.removeItem('learnify_current_user');
    navigate('/', { replace: true });
  }

  const monogramInitial = (profileData.name || 'L').charAt(0).toUpperCase();

  return (
    <section className="profilePage">
      <div className="profileCard">
        {toastMessage && <p className="profileToastMessage">{toastMessage}</p>}

        <div className="profileHeader">
          <div className="profileAvatarWrap" ref={photoMenuRef}>
            {profileData.profileImage ? (
              <button
                type="button"
                className="profileAvatarButton"
                onClick={() => setIsPhotoMenuOpen((prev) => !prev)}
                aria-label="Open photo options"
              >
                <img src={profileData.profileImage} alt="Profile" className="profileAvatarImage" />
              </button>
            ) : (
              <button
                type="button"
                className="profileAvatarButton"
                onClick={() => setIsPhotoMenuOpen((prev) => !prev)}
                aria-label="Open photo options"
              >
                <div className="profileAvatarMonogram" aria-label="Profile initials">
                  {monogramInitial}
                </div>
              </button>
            )}
            {isPhotoMenuOpen && (
              <div className="profilePhotoPopup" role="status">
                <button
                  type="button"
                  className="profilePhotoPopupButton"
                  onClick={() => {
                    if (profileData.profileImage) {
                      setIsPhotoPreviewOpen(true);
                      setIsPhotoMenuOpen(false);
                    }
                  }}
                  disabled={!profileData.profileImage}
                >
                  View Photo
                </button>
                <label className="profilePhotoPopupButton profilePhotoUploadLabel">
                  Upload Photo
                  <input type="file" accept="image/*" onChange={handleProfilePictureUpload} hidden />
                </label>
              </div>
            )}
          </div>

          <div className="profileHeaderInfo">
            <h2>My Profile</h2>
            <p>Manage your account details in one place.</p>
          </div>

        </div>

        <div className="profileDetailsGrid">
          <div className="profileDetailItem">
            <h4>Full Name</h4>
            <p>{profileData.name}</p>
          </div>
          <div className="profileDetailItem">
            <h4>Email</h4>
            <p>{profileData.email || 'Not provided'}</p>
          </div>
          <div className="profileDetailItem">
            <h4>Gender</h4>
            <p>{profileData.gender || 'Not selected'}</p>
          </div>
          <div className="profileDetailItem">
            <h4>User Type</h4>
            <p>{profileData.role}</p>
          </div>
          <div className="profileDetailItem">
            <h4>Phone Number</h4>
            <p>{profileData.phone || 'Not provided'}</p>
          </div>
          <div className="profileDetailItem">
            <h4>Address</h4>
            <p>{profileData.address || 'Not provided'}</p>
          </div>
          <div className="profileDetailItem">
            <h4>Country</h4>
            <p>{profileData.country || 'Not selected'}</p>
          </div>
        </div>

        <div className="profileActionsInline">
          <button type="button" className="profilePrimaryButton" onClick={openEditModal}>
            Edit Profile
          </button>
          <button type="button" className="profileDangerButton" onClick={() => setIsDeleteConfirmOpen(true)}>
            Delete Account
          </button>
        </div>
      </div>

      {isEditOpen && (
        <div className="lightboxOverlay" role="dialog" aria-modal="true">
          <div className="lightboxCard profileModalCard">
            <h3>Edit Profile</h3>
            <p className="authSubtext">Update your details below.</p>

            <div className="profileModalGrid">
              <div>
                <label>Full Name</label>
                <div className="profileReadonlyValue">{editForm.name}</div>
              </div>
              <div>
                <label>User Type</label>
                <div className="profileReadonlyValue">{editForm.role}</div>
              </div>
              <div>
                <label>Email</label>
                <div className="profileReadonlyValue">{editForm.email}</div>
              </div>
              <div>
                <label htmlFor="modal-phone">Phone Number</label>
                <input
                  id="modal-phone"
                  name="phone"
                  value={editForm.phone}
                  onChange={handleInputChange}
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <label htmlFor="modal-address">Address</label>
                <input
                  id="modal-address"
                  name="address"
                  value={editForm.address}
                  onChange={handleInputChange}
                  placeholder="Enter address"
                />
              </div>
              <div>
                <label htmlFor="modal-country">Country</label>
                <select
                  id="modal-country"
                  name="country"
                  value={editForm.country}
                  onChange={handleInputChange}
                  disabled={profileData.countryLocked}
                >
                  <option value="">Select country</option>
                  {COUNTRY_OPTIONS.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
                {profileData.countryLocked && <p className="hintText">Country is locked after first save.</p>}
              </div>
            </div>

            <div className="profileGenderRow">
              <span>Gender</span>
              <label>
                <input
                  type="radio"
                  name="gender"
                  value="Male"
                  checked={editForm.gender === 'Male'}
                  onChange={handleInputChange}
                  disabled={profileData.genderLocked}
                />
                Male
              </label>
              <label>
                <input
                  type="radio"
                  name="gender"
                  value="Female"
                  checked={editForm.gender === 'Female'}
                  onChange={handleInputChange}
                  disabled={profileData.genderLocked}
                />
                Female
              </label>
              <label>
                <input
                  type="radio"
                  name="gender"
                  value="Other"
                  checked={editForm.gender === 'Other'}
                  onChange={handleInputChange}
                  disabled={profileData.genderLocked}
                />
                Other
              </label>
            </div>
            {profileData.genderLocked && <p className="hintText">Gender is locked after first save.</p>}

            <div className="profileModalActions">
              <button type="button" className="heroButton" onClick={handleConfirmEdit}>
                Confirm
              </button>
              <button type="button" className="heroButton heroButtonSecondary" onClick={handleCancelEdit}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeleteConfirmOpen && (
        <div className="lightboxOverlay" role="alertdialog" aria-modal="true" aria-labelledby="delete-account-title">
          <div className="lightboxCard profileDeleteCard">
            <h3 id="delete-account-title">Delete account?</h3>
            <p>
              Are you sure you want to delete this account? This action is not reversible.
            </p>
            <div className="profileModalActions">
              <button type="button" className="profileDangerButton" onClick={handleDeactivateAccount}>
                Yes, Delete
              </button>
              <button
                type="button"
                className="heroButton heroButtonSecondary"
                onClick={() => setIsDeleteConfirmOpen(false)}
                ref={deleteCancelRef}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isPhotoPreviewOpen && profileData.profileImage && (
        <div
          className="lightboxOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="photo-preview-title"
          onClick={() => setIsPhotoPreviewOpen(false)}
        >
          <div className="lightboxCard profilePhotoPreviewCard" onClick={(event) => event.stopPropagation()}>
            <h3 id="photo-preview-title">Profile Photo</h3>
            <img src={profileData.profileImage} alt="Profile preview" className="profilePhotoPreviewImage" />
          </div>
        </div>
      )}
    </section>
  );
}
