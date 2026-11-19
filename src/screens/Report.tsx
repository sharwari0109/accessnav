
import { useEffect, useState } from 'react';

import { useApp } from '@/store';
import MumbaiMap from '@/components/MumbaiMap';
import TopBar from '@/components/TopBar';
import Button from '@/components/Button';
import Overlay from '@/components/Overlay';

import {
  getReportOptions,
  submitReport,
} from '@/api';

import { Check, MapPin, Info } from 'lucide-react';

export default function Report() {
  const {
    go,
    mode,
    destination,
  } = useApp();

  // ============================================================
  // STATE
  // ============================================================

  const [reportOptions, setReportOptions] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [desc, setDesc] = useState('');
  const [done, setDone] = useState(false);

  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [optionsError, setOptionsError] = useState('');
  const [submitError, setSubmitError] = useState('');

  // ============================================================
  // LOAD REPORT OPTIONS
  // ============================================================

  useEffect(() => {
    async function loadReportOptions() {
      try {
        setLoadingOptions(true);
        setOptionsError('');

        const data = await getReportOptions();

        setReportOptions(data);
      } catch (err) {
        console.error('Failed to load report options:', err);
        setOptionsError('Unable to load report options.');
      } finally {
        setLoadingOptions(false);
      }
    }

    loadReportOptions();
  }, []);

  // ============================================================
  // SUBMIT REPORT
  // ============================================================

  async function handleSubmit() {
    if (!selected || submitting) {
      return;
    }

    if (!destination) {
      setSubmitError(
        'Please select a location before submitting a report.'
      );
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError('');

      const response = await submitReport({
        placeId: destination.place?.id ?? null,
        placeName: destination.name,
        latitude: destination.lat,
        longitude: destination.lng,
        reportType: selected,
        description: desc.trim(),
      });

      console.log('Report submitted successfully:', response);

      setDone(true);
      setSelected(null);
      setDesc('');

    } catch (err) {
      console.error('Failed to submit report:', err);

      setSubmitError(
        'Unable to submit your report. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="screen-enter flex h-full w-full flex-col bg-white">

      {/* MAP HEADER */}

      <div className="relative h-44 w-full shrink-0 overflow-hidden">

        <MumbaiMap
          mode={mode}
          highContrast={mode === 'lowvision'}
          dim
        />

        <TopBar
          onBack={() => go('home')}
          transparent
        />

      </div>

      {/* CONTENT */}

      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-8 pt-4">

        <h1 className="text-xl font-extrabold text-slate-900">
          Report an accessibility issue
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Help make navigation safer and more accessible for everyone.
        </p>

        {/* COMMUNITY REPORT INFORMATION */}

        <div className="mt-4 flex gap-3 rounded-2xl border border-primary-200 bg-primary-50 p-3">

          <Info
            size={20}
            className="mt-0.5 shrink-0 text-primary-600"
          />

          <div>
            <p className="text-sm font-bold text-slate-900">
              Share accessibility information
            </p>

            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Report ramps, elevators, accessible entrances,
              sidewalk conditions and other facilities.
              Your contribution can help other users.
            </p>
          </div>

        </div>

        {/* REPORT OPTIONS */}

        <h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-slate-400">
          Select a report category
        </h2>

        <div className="mt-3 grid grid-cols-2 gap-2.5">

          {loadingOptions && (
            <div className="col-span-2 py-8 text-center text-sm text-slate-400">
              Loading report options...
            </div>
          )}

          {!loadingOptions && optionsError && (
            <div className="col-span-2 py-8 text-center">

              <p className="text-sm text-danger-500">
                {optionsError}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Make sure the backend is running.
              </p>

            </div>
          )}

          {!loadingOptions &&
            !optionsError &&
            reportOptions.map((opt) => {
              const isSelected = selected === opt;

              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    setSelected(opt);
                    setSubmitError('');
                  }}
                  aria-pressed={isSelected}
                  className={`flex min-h-14 items-center gap-2 rounded-2xl border-2 p-3.5 text-left text-sm font-semibold transition active:scale-[0.98] ${
                    isSelected
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-slate-200 text-slate-700'
                  }`}
                >

                  {isSelected && (
                    <Check
                      size={16}
                      strokeWidth={3}
                      className="shrink-0 text-primary-600"
                    />
                  )}

                  <span>{opt}</span>

                </button>
              );
            })}

        </div>

        {/* DESCRIPTION */}

        <h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-slate-400">
          Additional details
        </h2>

        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder={
            selected === 'Ramp available'
              ? 'Where is the ramp? Is it suitable for wheelchair access?'
              : selected === 'Broken ramp' || selected === 'Ramp blocked'
                ? 'Describe the ramp condition or obstruction...'
                : selected === 'Broken elevator' || selected === 'Elevator unavailable'
                  ? 'Where is the elevator? What problem did you notice?'
                  : 'Describe the location and accessibility condition...'
          }
          rows={4}
          className="mt-2 w-full resize-none rounded-2xl border border-slate-200 p-4 text-sm text-slate-900 outline-none focus:border-primary-500 placeholder:text-slate-400"
        />

        <p className="mt-1 text-xs text-slate-400">
          Add useful details to help other users understand the location.
        </p>

        {/* DESTINATION INFORMATION */}

        {destination && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl bg-slate-50 p-3">

            <MapPin
              size={19}
              className="mt-0.5 shrink-0 text-primary-600"
            />

            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Reporting location
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-900">
                {destination.name}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {destination.lat.toFixed(5)}, {destination.lng.toFixed(5)}
              </p>
            </div>

          </div>
        )}

        {!destination && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">

            <p className="text-sm font-semibold text-amber-800">
              No location selected
            </p>

            <p className="mt-1 text-xs text-amber-700">
              Select a destination on the map before submitting your report.
            </p>

          </div>
        )}

        {/* VERIFICATION INFORMATION */}

        <div className="mt-4 rounded-2xl border border-slate-200 p-3">

          <p className="text-xs font-bold text-slate-700">
            Community verification
          </p>

          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Your report will be marked as pending verification.
            It will not automatically become a confirmed accessibility facility.
          </p>

        </div>

        {/* ERROR */}

        {submitError && (
          <p className="mt-4 text-center text-sm text-danger-500">
            {submitError}
          </p>
        )}

        {/* SUBMIT */}

        <div className="mt-6">

          <Button
            fullWidth
            disabled={
              !selected ||
              !destination ||
              submitting ||
              loadingOptions ||
              !!optionsError
            }
            onClick={handleSubmit}
            className="text-lg"
          >
            {submitting ? 'Submitting...' : 'Submit Report'}
          </Button>

        </div>

      </div>

      {/* SUCCESS OVERLAY */}

      {done && (
        <Overlay onClose={() => setDone(false)}>

          <div className="mb-4 flex justify-center">

            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accessible-100">

              <Check
                size={32}
                className="text-accessible-600"
                strokeWidth={3}
              />

            </div>

          </div>

          <h2 className="text-center text-2xl font-extrabold text-slate-900">
            Thank you!
          </h2>

          <p className="mt-2 text-center text-sm text-slate-500">
            Your accessibility report has been submitted and is pending verification.
            Thank you for helping the ACCESSNAV community.
          </p>

          <div className="mt-6">

            <Button
              fullWidth
              onClick={() => {
                setDone(false);
                go('home');
              }}
            >
              Done
            </Button>

          </div>

        </Overlay>
      )}

    </div>
  );
}
