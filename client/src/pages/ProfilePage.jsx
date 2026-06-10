import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearAuthSession, getCurrentUser, updateCurrentUserProfile } from '../utils/authUtils';
import { deleteMe, fetchMe, updateMe } from '../utils/userApi';
import DeleteConfirmationDialog from '../components/DeleteConfirmationDialog';
import Toast from '../components/Toast';

const COUNTRY_OPTIONS = ['Pakistan', 'India', 'United Arab Emirates', 'Saudi Arabia', 'United Kingdom', 'United States'];
const SEMESTER_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

function buildProfileData(user) {
  return {
    name: user?.name || 'Learner',
    email: user?.email || '',
    role: user?.role || 'Student',
    phone: user?.phone || '',
    address: user?.address || '',
    country: user?.country || '',
    semester: user?.semester ? String(user.semester) : '',
    degreeProgram: user?.degreeProgram || '',
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
  const [formError, setFormError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteConfirmationStep, setDeleteConfirmationStep] = useState('account');
  const photoMenuRef = useRef(null);
  const isStudentProfile = String(profileData.role || '').toLowerCase() === 'student';
  const isInstructorProfile = String(profileData.role || '').toLowerCase() === 'instructor';

  useEffect(() => {
    let isMounted = true;

    fetchMe()
      .then((user) => {
        if (!isMounted || !user) return;
        updateCurrentUserProfile(user);
        const nextProfile = buildProfileData(user);
        setProfileData(nextProfile);
        setEditForm(nextProfile);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

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

  function showSuccessToast(message) {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage('');
    }, 5000);
  }

  function openEditModal() {
    setEditForm(profileData);
    setFormError('');
    setIsEditOpen(true);
  }

  function handleCancelEdit() {
    setEditForm(profileData);
    setFormError('');
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
    reader.onload = async () => {
      const imageData = reader.result;
      try {
        const updatedUser = await updateMe({ profileImage: imageData });
        updateCurrentUserProfile(updatedUser);
        setProfileData((prev) => ({ ...prev, profileImage: imageData }));
        window.dispatchEvent(new Event('learnify-user-updated'));
        showSuccessToast('Successfully updated!');
        setIsPhotoMenuOpen(false);
      } catch {
        showSuccessToast('Could not update profile photo.');
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleConfirmEdit() {
    const isStudentEdit = String(editForm.role || '').toLowerCase() === 'student';
    const degreeProgram = editForm.degreeProgram.trim();
    const semester = Number(editForm.semester);

    if (isStudentEdit) {
      if (!degreeProgram) {
        setFormError('Degree Program is required for student profiles.');
        return;
      }

      if (!Number.isInteger(semester) || semester < 1 || semester > 12) {
        setFormError('Semester must be selected between 1 and 12.');
        return;
      }
    }

    const updatedProfile = {
      phone: editForm.phone,
      address: editForm.address,
      semester: editForm.semester ? semester : undefined,
      degreeProgram: degreeProgram || undefined,
      gender: editForm.gender,
      country: editForm.country,
      // Lock these after first confirmation as requested.
      genderLocked: true,
      countryLocked: true,
    };

    try {
      const updatedUser = await updateMe(updatedProfile);
      updateCurrentUserProfile(updatedUser);
      const mergedProfile = buildProfileData(updatedUser);
      setProfileData(mergedProfile);
      setEditForm(mergedProfile);
      setFormError('');
      setIsEditOpen(false);
      window.dispatchEvent(new Event('learnify-user-updated'));
      showSuccessToast('Successfully updated!');
    } catch {
      showSuccessToast('Could not update profile.');
    }
  }

  async function handleDeleteAccount() {
    if (isInstructorProfile && deleteConfirmationStep === 'account') {
      setDeleteConfirmationStep('owned-courses');
      return;
    }

    setIsDeletingAccount(true);

    try {
      await deleteMe({ deleteOwnedCourses: isInstructorProfile });
      const deletedEmail = String(profileData.email || '').toLowerCase();
      try {
        const cachedUsers = JSON.parse(localStorage.getItem('learnify_users') || '[]');
        if (Array.isArray(cachedUsers)) {
          localStorage.setItem(
            'learnify_users',
            JSON.stringify(cachedUsers.filter((user) => String(user.email || '').toLowerCase() !== deletedEmail)),
          );
        }
      } catch {
        localStorage.removeItem('learnify_users');
      }
      try {
        const cachedCourses = JSON.parse(localStorage.getItem('learnify_courses') || '[]');
        if (Array.isArray(cachedCourses)) {
          localStorage.setItem(
            'learnify_courses',
            JSON.stringify(cachedCourses.filter((course) => String(course.ownerEmail || '').toLowerCase() !== deletedEmail)),
          );
        }
      } catch {
        localStorage.removeItem('learnify_courses');
      }
      setIsDeleteConfirmOpen(false);
      showSuccessToast('Account and personal data deleted successfully.');
      window.setTimeout(() => {
        clearAuthSession();
        navigate('/', { replace: true });
      }, 900);
    } catch (error) {
      showSuccessToast(error.message || 'Could not delete account.');
    } finally {
      setIsDeletingAccount(false);
    }
  }

  function handleDeleteAccountCancel() {
    if (isDeletingAccount) return;
    setIsDeleteConfirmOpen(false);
    setDeleteConfirmationStep('account');
  }

  const monogramInitial = (profileData.name || 'L').charAt(0).toUpperCase();

  return (
    <section className="profilePage">
      <Toast message={toastMessage} />
      <div className="profileCard">
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
          {isStudentProfile && (
            <>
              <div className="profileDetailItem">
                <h4>Degree Program</h4>
                <p>{profileData.degreeProgram || 'Not provided'}</p>
              </div>
              <div className="profileDetailItem">
                <h4>Semester</h4>
                <p>{profileData.semester ? `Semester ${profileData.semester}` : 'Not selected'}</p>
              </div>
            </>
          )}
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
          <button
            type="button"
            className="profileDangerButton"
            onClick={() => {
              setDeleteConfirmationStep('account');
              setIsDeleteConfirmOpen(true);
            }}
          >
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
              {String(editForm.role || '').toLowerCase() === 'student' && (
                <>
                  <div>
                    <label htmlFor="modal-degree-program">Degree Program</label>
                    <input
                      id="modal-degree-program"
                      name="degreeProgram"
                      value={editForm.degreeProgram}
                      onChange={handleInputChange}
                      placeholder="BS Computer Science"
                      maxLength={120}
                    />
                  </div>
                  <div>
                    <label htmlFor="modal-semester">Semester</label>
                    <select
                      id="modal-semester"
                      name="semester"
                      value={editForm.semester}
                      onChange={handleInputChange}
                    >
                      <option value="">Select semester</option>
                      {SEMESTER_OPTIONS.map((semester) => (
                        <option key={semester} value={semester}>
                          Semester {semester}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
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
            {formError && <p className="errorText formError">{formError}</p>}

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
        <DeleteConfirmationDialog
          title={deleteConfirmationStep === 'owned-courses' ? 'Delete Instructor Account and Courses?' : 'Delete Account?'}
          message={
            deleteConfirmationStep === 'owned-courses'
              ? 'Delete instructor account and all owned courses?'
              : 'Are you sure you want to permanently delete your account?'
          }
          impact={
            deleteConfirmationStep === 'owned-courses'
              ? 'All courses created by this instructor, their modules/items, enrollments, student progress, quiz attempts, submissions, and notes for those courses will be deleted from the database. This action cannot be undone.'
              : 'Your account, profile, enrollments, progress, notes, quiz attempts, assignment submissions, and uploaded assets will be deleted from the database. This action cannot be undone.'
          }
          isProcessing={isDeletingAccount}
          onCancel={handleDeleteAccountCancel}
          onConfirm={handleDeleteAccount}
        />
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
