import React, { useState, useEffect } from 'react';
import { User, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { InlineBanner, LoadingSkeleton } from '../components/ui/StateViews';

export default function ProfilePage() {
  const { user, role, refreshUser } = useAuth();

  // Profile fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Status states
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [profileSuccessMessage, setProfileSuccessMessage] = useState('');
  const [profileErrorMessage, setProfileErrorMessage] = useState('');
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState('');
  const [passwordErrorMessage, setPasswordErrorMessage] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileErrorMessage('');
    setProfileSuccessMessage('');

    if (!name.trim()) {
      setProfileErrorMessage('Name cannot be empty.');
      return;
    }

    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setProfileErrorMessage('Please provide a valid email address.');
      return;
    }

    setIsUpdatingProfile(true);
    try {
      await authAPI.updateUserProfile(user._id, {
        name: name.trim(),
        email: email.toLowerCase().trim(),
      });
      await refreshUser();
      setProfileSuccessMessage('Profile details updated.');
    } catch (err) {
      if (err.status === 409) {
        setProfileErrorMessage('This email is already in use by another account.');
      } else {
        setProfileErrorMessage(err.message || 'Failed to update profile.');
      }
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordErrorMessage('');
    setPasswordSuccessMessage('');

    if (!currentPassword) {
      setPasswordErrorMessage('Current password is required.');
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      setPasswordErrorMessage('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordErrorMessage('New passwords do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await authAPI.updateUserProfile(user._id, {
        password: newPassword,
        currentPassword,
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccessMessage('Password updated successfully.');
    } catch (err) {
      if (err.status === 401) {
        setPasswordErrorMessage('Incorrect current password.');
      } else {
        setPasswordErrorMessage(err.message || 'Failed to update password.');
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (!user) {
    return (
      <div className="p-8 max-w-3xl mx-auto w-full">
        <LoadingSkeleton variant="profile" />
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-8 max-w-3xl mx-auto">
      {/* Top Header: Avatar + Name + Role Badge */}
      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full bg-slate-900 text-white flex items-center justify-center text-2xl font-bold shadow-sm mb-3">
          {user.name ? user.name.charAt(0).toUpperCase() : <User className="w-8 h-8" />}
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {user.name}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">{user.email}</p>
        <span className="mt-2 px-3 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-slate-100 text-slate-700">
          {role}
        </span>
      </div>

      {/* Two clean side-by-side white cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Card 1: Profile Details */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(15,23,42,0.04)] p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Profile Details
          </h2>

          {profileSuccessMessage && (
            <InlineBanner
              type="success"
              message={profileSuccessMessage}
              onDismiss={() => setProfileSuccessMessage('')}
            />
          )}
          {profileErrorMessage && (
            <InlineBanner
              type="error"
              message={profileErrorMessage}
              onDismiss={() => setProfileErrorMessage('')}
            />
          )}

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:border-slate-900 transition-all text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:border-slate-900 transition-all text-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={isUpdatingProfile}
              className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isUpdatingProfile && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Changes</span>
            </button>
          </form>
        </div>

        {/* Card 2: Change Password */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(15,23,42,0.04)] p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Change Password
          </h2>

          {passwordSuccessMessage && (
            <InlineBanner
              type="success"
              message={passwordSuccessMessage}
              onDismiss={() => setPasswordSuccessMessage('')}
            />
          )}
          {passwordErrorMessage && (
            <InlineBanner
              type="error"
              message={passwordErrorMessage}
              onDismiss={() => setPasswordErrorMessage('')}
            />
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Current Password
              </label>
              <div className="relative flex items-center">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full h-11 pl-4 pr-10 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:border-slate-900 transition-all text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 text-slate-400 hover:text-slate-600"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Password
              </label>
              <div className="relative flex items-center">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full h-11 pl-4 pr-10 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:border-slate-900 transition-all text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 text-slate-400 hover:text-slate-600"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm New Password
              </label>
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:border-slate-900 transition-all text-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={isUpdatingPassword}
              className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isUpdatingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Update Password</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
