
import { useEffect, useRef, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { useApp } from '@/store';
import Overlay from '@/components/Overlay';
import Button from '@/components/Button';
import {
  Phone,
  Share2,
  X,
  AlertCircle,
  MapPin,
  UserPlus,
  Trash2,
  Users,
  ChevronDown,
} from 'lucide-react';

import {
  getEmergencyContacts,
  addEmergencyContact,
  deleteEmergencyContact,
  activateSOS,
  type EmergencyContact,
} from '@/api';

const HOLD_MS = 1500;

export default function SOS() {
  const { go, sosActive, setSosActive } = useApp();

  const [holding, setHolding] = useState(false);
  const [pct, setPct] = useState(0);

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsExpanded, setContactsExpanded] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');

  const [savingContact, setSavingContact] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [activating, setActivating] = useState(false);
  const [sharing, setSharing] = useState(false);

  const [mapsUrl, setMapsUrl] = useState('');
  const [contactsCount, setContactsCount] = useState(0);
  const [notificationStatus, setNotificationStatus] = useState('');

  const raf = useRef<number | null>(null);
  const start = useRef(0);
  const activationInProgress = useRef(false);

  // LOAD EMERGENCY CONTACTS

  const loadContacts = async () => {
    try {
      setContactsLoading(true);
      setError('');

      const response = await getEmergencyContacts();
      setContacts(response.contacts || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load emergency contacts.'
      );
    } finally {
      setContactsLoading(false);
    }
  };

  useEffect(() => {
    void loadContacts();
  }, []);

  // GET CURRENT GPS LOCATION

  const getCurrentLocation = async () => {
    // ANDROID APP: Use Capacitor Geolocation

    if (Capacitor.isNativePlatform()) {
      const permission = await Geolocation.checkPermissions();

      if (
        permission.location !== 'granted' &&
        permission.coarseLocation !== 'granted'
      ) {
        const requested = await Geolocation.requestPermissions();

        if (
          requested.location !== 'granted' &&
          requested.coarseLocation !== 'granted'
        ) {
          throw new Error(
            'Location permission is required to activate SOS.'
          );
        }
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
    }

    // WEBSITE: Use browser Geolocation API

    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported by this browser.');
    }

    return new Promise<{
      latitude: number;
      longitude: number;
      accuracy: number;
    }>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (error) => {
          reject(
            new Error(
              error.code === 1
                ? 'Please allow location access in your browser.'
                : error.code === 2
                  ? 'Your current location is unavailable.'
                  : 'Location request timed out. Please try again.'
            )
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    });
  };

  // ADD EMERGENCY CONTACT

  const handleAddContact = async () => {
    if (!name.trim() || !phone.trim()) {
      setError('Please enter the contact name and phone number.');
      return;
    }

    try {
      setSavingContact(true);
      setError('');
      setSuccess('');

      await addEmergencyContact({
        name: name.trim(),
        phone: phone.trim(),
        relationship: relationship.trim(),
      });

      setName('');
      setPhone('');
      setRelationship('');

      await loadContacts();

      setSuccess('Emergency contact added successfully.');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to add emergency contact.'
      );
    } finally {
      setSavingContact(false);
    }
  };

  // DELETE EMERGENCY CONTACT

  const handleDeleteContact = async (contactId: string) => {
    try {
      setError('');
      setSuccess('');

      await deleteEmergencyContact(contactId);

      setContacts((previous) =>
        previous.filter((contact) => contact.id !== contactId)
      );

      setSuccess('Emergency contact deleted.');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete emergency contact.'
      );
    }
  };

  // ACTIVATE SOS

  const activateEmergency = async () => {
    if (activationInProgress.current) return;

    activationInProgress.current = true;
    setActivating(true);
    setError('');

    try {
      const location = await getCurrentLocation();

      const response = await activateSOS({
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
      });

      setMapsUrl(response.location.maps_url);
      setContactsCount(response.contacts_count);
      setNotificationStatus(response.notification_status);

      setSosActive(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to activate SOS. Please try again.'
      );
    } finally {
      setActivating(false);
      activationInProgress.current = false;
    }
  };

  // HOLD TO ACTIVATE

  const beginHold = () => {
    if (sosActive || activating || activationInProgress.current) {
      return;
    }

    setError('');
    setHolding(true);
    start.current = performance.now();

    const tick = () => {
      const elapsed = performance.now() - start.current;
      const progress = Math.min(1, elapsed / HOLD_MS);

      setPct(progress);

      if (progress >= 1) {
        setHolding(false);
        setPct(0);
        raf.current = null;
        void activateEmergency();
        return;
      }

      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
  };

  const endHold = () => {
    if (raf.current !== null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }

    setHolding(false);
    setPct(0);
  };

  // OPEN SMS APP WITH EMERGENCY MESSAGE

  const messageEmergencyContact = async (
    contact: EmergencyContact
  ) => {
    try {
      setError('');

      // Use the SOS location if already available.
      // Otherwise, get the current location.

      let locationUrl = mapsUrl;

      if (!locationUrl) {
        const location = await getCurrentLocation();

        locationUrl =
          `https://www.google.com/maps?q=` +
          `${location.latitude},${location.longitude}`;
      }

      const message = encodeURIComponent(
        `EMERGENCY ALERT: I need help. My current location is: ${locationUrl}`
      );

      const cleanPhone = contact.phone.replace(/[^\d+]/g, '');

      window.location.href = `sms:${cleanPhone}?body=${message}`;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to open the messaging app.'
      );
    }
  };

  // CALL EMERGENCY SERVICES

  const callEmergencyServices = () => {
    window.location.href = 'tel:112';
  };

  // CALL FIRST EMERGENCY CONTACT

  const callEmergencyContact = () => {
    if (!contacts.length) {
      setError('Please add an emergency contact first.');
      return;
    }

    const cleanPhone = contacts[0].phone.replace(/[^\d+]/g, '');

    window.location.href = `tel:${cleanPhone}`;
  };

  // SHARE CURRENT LOCATION

  const shareCurrentLocation = async () => {
    try {
      setSharing(true);
      setError('');

      const location = await getCurrentLocation();

      const url =
        `https://www.google.com/maps?q=` +
        `${location.latitude},${location.longitude}`;

      const message = `My current location: ${url}`;

      if (navigator.share) {
        await navigator.share({
          title: 'My Emergency Location',
          text: message,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(message);
        setSuccess('Location link copied. You can share it with someone.');
      } else {
        window.open(url, '_blank');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to share your location.'
      );
    } finally {
      setSharing(false);
    }
  };

  // CLEANUP

  useEffect(() => {
    return () => {
      if (raf.current !== null) {
        cancelAnimationFrame(raf.current);
      }
    };
  }, []);

  // UI

  return (
    <div className="screen-enter relative h-full w-full overflow-y-auto bg-slate-50 text-slate-900">

      {/* HEADER */}

      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4">
        <button
          onClick={() => go('home')}
          aria-label="Close"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-800 transition-colors hover:bg-slate-200"
        >
          <X size={22} />
        </button>

        <span className="text-base font-bold text-slate-900">
          Emergency Assistance
        </span>

        <div className="w-11" />
      </div>

      {/* ERROR MESSAGE */}

      {error && (
        <div
          role="alert"
          className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800"
        >
          {error}
        </div>
      )}

      {/* SUCCESS MESSAGE */}

      {success && (
        <div
          role="status"
          className="mx-5 mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800"
        >
          {success}
        </div>
      )}

      {!sosActive ? (
        <div className="flex flex-col items-center px-6 pb-10 text-center">

          {/* INTRODUCTION */}

          <div className="mb-3 mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertCircle size={32} className="text-red-700" />
          </div>

          <h1 className="text-2xl font-extrabold text-slate-950">
            Need immediate help?
          </h1>

          <p className="mt-2 max-w-sm text-base leading-relaxed text-slate-700">
            Press and hold the button below to activate SOS.
          </p>

          {/* SOS HOLD BUTTON */}

          <div className="relative mt-10">
            <div className="absolute inset-0 animate-sos-pulse rounded-full" />

            <button
              onPointerDown={beginHold}
              onPointerUp={endHold}
              onPointerLeave={endHold}
              onPointerCancel={endHold}
              disabled={activating}
              aria-label="Hold to activate SOS"
              className="relative flex h-44 w-44 items-center justify-center rounded-full bg-red-700 text-white shadow-lg ring-4 ring-red-200 select-none touch-none transition-colors hover:bg-red-800 disabled:opacity-60"
            >
              <svg
                className="absolute inset-0 -rotate-90"
                viewBox="0 0 100 100"
                aria-hidden="true"
              >
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="none"
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth="6"
                />

                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 46}
                  strokeDashoffset={2 * Math.PI * 46 * (1 - pct)}
                />
              </svg>

              <div className="relative flex flex-col items-center">
                <span className="text-2xl font-extrabold tracking-wider">
                  {activating ? 'WAIT' : 'HOLD'}
                </span>

                <span className="text-base font-bold tracking-widest">
                  SOS
                </span>
              </div>
            </button>
          </div>

          <p className="mt-6 text-sm font-medium text-slate-700">
            {activating
              ? 'Getting your location and recording SOS...'
              : holding
                ? `Hold for ${Math.ceil(
                    (HOLD_MS * (1 - pct)) / 1000
                  )}s...`
                : 'Press and hold for 1.5 seconds'}
          </p>

          {/* EMERGENCY ACTIONS */}

          <div className="mt-8 w-full space-y-3">

            <Button
              fullWidth
              variant="danger"
              onClick={callEmergencyServices}
            >
              <Phone size={20} />
              Call Emergency Services (112)
            </Button>

            <Button
              fullWidth
              variant="secondary"
              className="border border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
              onClick={callEmergencyContact}
              disabled={contacts.length === 0}
            >
              <Phone size={20} />
              Call Emergency Contact
            </Button>

            <Button
              fullWidth
              variant="secondary"
              className="border border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
              onClick={() => {
                if (contacts.length === 0) {
                  setError('Please add an emergency contact first.');
                  return;
                }

                void messageEmergencyContact(contacts[0]);
              }}
              disabled={contacts.length === 0}
            >
              Message Emergency Contact
            </Button>

            <Button
              fullWidth
              variant="secondary"
              className="border border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
              onClick={shareCurrentLocation}
              disabled={sharing}
            >
              <Share2 size={20} />
              {sharing ? 'Getting Location...' : 'Share Current Location'}
            </Button>
          </div>

          {/* COLLAPSIBLE EMERGENCY CONTACT MANAGEMENT */}

          <div className="mt-8 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm">

            <button
              type="button"
              onClick={() =>
                setContactsExpanded((previous) => !previous)
              }
              aria-expanded={contactsExpanded}
              className="flex min-h-20 w-full items-center justify-between p-5 text-left transition-colors hover:bg-slate-50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-800">
                  <Users size={22} />
                </div>

                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-900">
                    Manage Emergency Contacts
                  </h2>

                  <p className="mt-1 text-sm text-slate-600">
                    {contactsLoading
                      ? 'Loading contacts...'
                      : `${contacts.length} saved ${
                          contacts.length === 1 ? 'contact' : 'contacts'
                        }`}
                  </p>
                </div>
              </div>

              <ChevronDown
                size={22}
                className={`ml-3 shrink-0 text-slate-700 transition-transform duration-200 ${
                  contactsExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>

            {contactsExpanded && (
              <div className="border-t border-slate-200 p-5">

                {contactsLoading ? (
                  <p className="text-sm text-slate-600">
                    Loading contacts...
                  </p>
                ) : contacts.length === 0 ? (
                  <p className="mb-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                    No emergency contacts added yet.
                  </p>
                ) : (
                  <div className="mb-5 space-y-3">
                    {contacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">
                            {contact.name}
                          </p>

                          <p className="text-sm text-slate-700">
                            {contact.phone}
                          </p>

                          {contact.relationship && (
                            <p className="mt-1 text-sm text-slate-600">
                              {contact.relationship}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            void handleDeleteContact(contact.id)
                          }
                          aria-label={`Delete ${contact.name}`}
                          className="ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-red-700 transition-colors hover:bg-red-50"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* ADD CONTACT FORM */}

                <div className="space-y-3">
                  <p className="font-bold text-slate-900">
                    Add Emergency Contact
                  </p>

                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Contact name"
                    aria-label="Contact name"
                    maxLength={80}
                    className="min-h-12 w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-900 placeholder:text-slate-500 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                  />

                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="Phone number"
                    aria-label="Phone number"
                    maxLength={20}
                    className="min-h-12 w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-900 placeholder:text-slate-500 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                  />

                  <input
                    value={relationship}
                    onChange={(event) =>
                      setRelationship(event.target.value)
                    }
                    placeholder="Relationship (optional)"
                    aria-label="Relationship (optional)"
                    maxLength={40}
                    className="min-h-12 w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-900 placeholder:text-slate-500 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                  />

                  <Button
                    fullWidth
                    variant="primary"
                    onClick={() => void handleAddContact()}
                    disabled={savingContact}
                  >
                    <UserPlus size={20} />
                    {savingContact ? 'Saving...' : 'Add Contact'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <p className="mt-5 max-w-sm px-2 text-sm leading-relaxed text-slate-600">
            SOS activation records your location and saved contacts.
            You can prepare an emergency SMS for a saved contact. You must
            review and send the message yourself.
          </p>
        </div>
      ) : (
        <Overlay onClose={() => setSosActive(false)}>
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <AlertCircle size={32} className="text-red-700" />
            </div>
          </div>

          <h2 className="text-center text-3xl font-extrabold text-red-800">
            SOS ACTIVATED
          </h2>

          <p className="mt-3 text-center text-base text-slate-700">
            Your SOS alert has been recorded.
          </p>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
            <div className="mb-2 flex justify-center">
              <MapPin size={24} className="text-blue-700" />
            </div>

            <p className="text-sm text-slate-600">
              Your current location
            </p>

            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block text-base font-semibold text-blue-800 underline"
              >
                View location on Google Maps
              </a>
            ) : (
              <p className="text-sm text-slate-600">
                Location unavailable
              </p>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
            <p className="text-base font-semibold text-slate-900">
              Saved emergency contacts: {contactsCount}
            </p>

            <p className="mt-2 text-sm leading-relaxed text-amber-800">
              {notificationStatus === 'not_configured'
                ? 'Automatic SMS alerts have not been sent. You can prepare a message manually below.'
                : `Notification status: ${notificationStatus || 'Unknown'}`}
            </p>
          </div>

          <div className="mt-6 space-y-3">

            <Button
              fullWidth
              variant="danger"
              onClick={callEmergencyServices}
            >
              <Phone size={20} />
              Call Emergency Services (112)
            </Button>

            <Button
              fullWidth
              variant="secondary"
              onClick={callEmergencyContact}
              disabled={contacts.length === 0}
            >
              <Phone size={20} />
              Call Emergency Contact
            </Button>

            <Button
              fullWidth
              variant="secondary"
              onClick={() => {
                if (contacts.length === 0) {
                  setError('Please add an emergency contact first.');
                  return;
                }

                void messageEmergencyContact(contacts[0]);
              }}
              disabled={contacts.length === 0}
            >
              Message Emergency Contact
            </Button>

            <Button
              fullWidth
              variant="secondary"
              onClick={shareCurrentLocation}
              disabled={sharing}
            >
              <Share2 size={20} />
              {sharing ? 'Getting Location...' : 'Share Current Location'}
            </Button>

            <Button
              fullWidth
              variant="secondary"
              onClick={() => setSosActive(false)}
            >
              Close
            </Button>
          </div>
        </Overlay>
      )}
    </div>
  );
}
