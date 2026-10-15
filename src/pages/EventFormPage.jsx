import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Users, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { eventsAPI } from '../services/api';
import { formatEventDate, formatEventTime } from '../utils/dateUtils';
import { InlineBanner, LoadingSkeleton } from '../components/ui/StateViews';

export default function EventFormPage() {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Form Fields
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [venue, setVenue] = useState('');
  const [capacity, setCapacity] = useState(40);
  const [description, setDescription] = useState('');

  const [initialEvent, setInitialEvent] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isEditMode) {
      const fetchEvent = async () => {
        try {
          setIsLoading(true);
          const data = await eventsAPI.getById(id);
          setInitialEvent(data);
          setTitle(data.title || '');
          setVenue(data.venue || '');
          setCapacity(data.capacity || 40);
          setDescription(data.description || '');

          if (data.date) {
            const d = new Date(data.date);
            const offset = d.getTimezoneOffset() * 60000;
            const localISOTime = new Date(d.getTime() - offset).toISOString().slice(0, 16);
            setDate(localISOTime);
          }
        } catch (err) {
          setGeneralError(err.message || 'Failed to load event details.');
        } finally {
          setIsLoading(false);
        }
      };
      fetchEvent();
    } else {
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 7);
      defaultDate.setHours(9, 0, 0, 0);
      const offset = defaultDate.getTimezoneOffset() * 60000;
      setDate(new Date(defaultDate.getTime() - offset).toISOString().slice(0, 16));
    }
  }, [id, isEditMode]);

  const validateForm = () => {
    const errors = {};

    if (!title.trim()) {
      errors.title = 'Title is required';
    } else if (title.trim().length > 150) {
      errors.title = 'Title cannot exceed 150 characters';
    }

    if (!venue.trim()) {
      errors.venue = 'Venue is required';
    } else if (venue.trim().length > 200) {
      errors.venue = 'Venue cannot exceed 200 characters';
    }

    if (!description.trim()) {
      errors.description = 'Description is required';
    } else if (description.trim().length > 5000) {
      errors.description = 'Description cannot exceed 5000 characters';
    }

    if (!date) {
      errors.date = 'Date and start time are required';
    } else {
      const selectedDate = new Date(date);
      if (isNaN(selectedDate.getTime())) {
        errors.date = 'Invalid date format';
      } else if (!isEditMode && selectedDate <= new Date()) {
        errors.date = 'Event date must be in the future';
      }
    }

    const capNum = parseInt(capacity, 10);
    if (isNaN(capNum) || capNum < 1) {
      errors.capacity = 'Capacity must be at least 1';
    } else if (isEditMode && initialEvent && capNum < (initialEvent.registeredCount || 0)) {
      errors.capacity = `Cannot reduce capacity below registered count (${initialEvent.registeredCount})`;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        venue: venue.trim(),
        description: description.trim(),
        capacity: parseInt(capacity, 10),
        date: new Date(date).toISOString(),
      };

      if (isEditMode) {
        await eventsAPI.update(id, payload);
      } else {
        await eventsAPI.create(payload);
      }

      navigate('/organizer');
    } catch (err) {
      if (err.status === 409) {
        setGeneralError(err.message || 'Capacity conflict.');
        setFieldErrors((prev) => ({
          ...prev,
          capacity: err.message,
        }));
      } else if (err.status === 400 && err.errors) {
        setFieldErrors(err.errors);
        setGeneralError('Please fix the indicated validation errors.');
      } else {
        setGeneralError(err.message || 'Failed to save event.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto w-full">
        <LoadingSkeleton variant="card" count={2} />
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Top Header: Back link + Title */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/organizer"
            className="w-10 h-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-sm"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {isEditMode ? 'Edit Event' : 'Create Event'}
          </h1>
        </div>
      </div>

      {generalError && (
        <InlineBanner
          type="error"
          message={generalError}
          onDismiss={() => setGeneralError('')}
        />
      )}

      {/* Grid: Form on left, Preview on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Card (lg:col-span-7) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(15,23,42,0.04)] p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Title
                </label>
                <span className={`text-[11px] ${title.length > 150 ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
                  {title.length} / 150
                </span>
              </div>
              <input
                type="text"
                required
                maxLength={150}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (fieldErrors.title) setFieldErrors((prev) => ({ ...prev, title: null }));
                }}
                placeholder="e.g. Intro to Web Development"
                className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:border-slate-900 transition-all text-slate-900 placeholder:text-slate-400"
              />
              {fieldErrors.title && (
                <p className="text-xs text-red-600 mt-1">{fieldErrors.title}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    if (fieldErrors.date) setFieldErrors((prev) => ({ ...prev, date: null }));
                  }}
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:border-slate-900 transition-all text-slate-900"
                />
                {fieldErrors.date && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.date}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Capacity
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={capacity}
                  onChange={(e) => {
                    setCapacity(e.target.value);
                    if (fieldErrors.capacity) setFieldErrors((prev) => ({ ...prev, capacity: null }));
                  }}
                  className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:border-slate-900 transition-all text-slate-900"
                />
                {isEditMode && initialEvent && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Current registrations: <span className="font-semibold text-slate-800">{initialEvent.registeredCount || 0}</span> (Capacity cannot be set lower than {initialEvent.registeredCount || 0})
                  </p>
                )}
                {fieldErrors.capacity && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.capacity}</p>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Venue
                </label>
                <span className={`text-[11px] ${venue.length > 200 ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
                  {venue.length} / 200
                </span>
              </div>
              <input
                type="text"
                required
                maxLength={200}
                value={venue}
                onChange={(e) => {
                  setVenue(e.target.value);
                  if (fieldErrors.venue) setFieldErrors((prev) => ({ ...prev, venue: null }));
                }}
                placeholder="e.g. CCS Lab 3"
                className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:border-slate-900 transition-all text-slate-900 placeholder:text-slate-400"
              />
              {fieldErrors.venue && (
                <p className="text-xs text-red-600 mt-1">{fieldErrors.venue}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Description
                </label>
                <span className={`text-[11px] ${description.length > 5000 ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
                  {description.length} / 5000
                </span>
              </div>
              <textarea
                id="event-description"
                rows={5}
                required
                maxLength={5000}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (fieldErrors.description) setFieldErrors((prev) => ({ ...prev, description: null }));
                }}
                placeholder="Detailed information about the event..."
                className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:border-slate-900 transition-all text-slate-900 placeholder:text-slate-400 resize-y"
              />
              {fieldErrors.description && (
                <p className="text-xs text-red-600 mt-1">{fieldErrors.description}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Link
                to="/organizer"
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.99] disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isEditMode ? 'Save Changes' : 'Create Event'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Live Preview Card (lg:col-span-5) */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(15,23,42,0.04)] p-6 space-y-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
            Live Preview
          </span>

          <div className="space-y-3">
            <h3 className="text-lg font-bold text-slate-900 break-words">
              {title.trim() || 'Untitled Event'}
            </h3>
            <p className="text-xs text-slate-500">
              Organized by {user?.name || 'You'}
            </p>

            <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>
                  {date ? `${formatEventDate(date, { month: 'short', day: 'numeric', year: 'numeric' })} • ${formatEventTime(date)}` : 'Date & time not set'}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{venue.trim() || 'Venue not set'}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Capacity: {capacity || 0} seats</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                Description
              </span>
              <p className="text-xs text-slate-600 whitespace-pre-line line-clamp-6 leading-relaxed">
                {description.trim() || 'No description provided yet.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
