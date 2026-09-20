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

import { Check } from 'lucide-react';


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

  const [error, setError] = useState('');


  // ============================================================
  // LOAD REPORT OPTIONS FROM BACKEND
  // ============================================================

  useEffect(() => {
    async function loadReportOptions() {
      try {
        setLoadingOptions(true);
        setError('');

        const data = await getReportOptions();

        setReportOptions(data);
      } catch (err) {
        console.error(
          'Failed to load report options:',
          err
        );

        setError(
          'Unable to load report options.'
        );
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
    if (!selected) {
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      /*
       * If the user came from a destination screen,
       * send that place ID.
       *
       * If no destination is selected, use a temporary
       * "unknown" value.
       */
      const placeId =
        destination?.id ?? 'unknown';


      const response = await submitReport({
        placeId: placeId,
        reportType: selected,
        description: desc,
      });


      console.log(
        'Report submitted successfully:',
        response
      );


      // Show success popup
      setDone(true);


      // Clear form
      setSelected(null);
      setDesc('');

    } catch (err) {
      console.error(
        'Failed to submit report:',
        err
      );

      setError(
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

      {/* ======================================================
          MAP HEADER
      ====================================================== */}

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


      {/* ======================================================
          CONTENT
      ====================================================== */}

      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-8 pt-4">

        <h1 className="text-xl font-extrabold text-slate-900">
          Report an accessibility issue
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Help make navigation safer for everyone.
        </p>


        {/* ==================================================
            REPORT OPTIONS
        ================================================== */}

        <div className="mt-5 grid grid-cols-2 gap-2.5">

          {loadingOptions && (
            <div className="col-span-2 py-8 text-center text-sm text-slate-400">
              Loading report options...
            </div>
          )}


          {!loadingOptions && error && (
            <div className="col-span-2 py-8 text-center">

              <p className="text-sm text-danger-500">
                {error}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Make sure the FastAPI backend is running.
              </p>

            </div>
          )}


          {!loadingOptions &&
            !error &&
            reportOptions.map((opt) => {

              const isSel =
                selected === opt;

              return (
                <button
                  key={opt}
                  onClick={() =>
                    setSelected(opt)
                  }
                  className={`flex items-center gap-2 rounded-2xl border-2 p-3.5 text-left text-sm font-semibold transition active:scale-[0.98] ${
                    isSel
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-slate-200 text-slate-700'
                  }`}
                >

                  {isSel && (
                    <Check
                      size={16}
                      strokeWidth={3}
                      className="text-primary-600"
                    />
                  )}

                  {opt}

                </button>
              );
            })}

        </div>


        {/* ==================================================
            DESCRIPTION
        ================================================== */}

        <h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-slate-400">
          Description
        </h2>

        <textarea
          value={desc}
          onChange={(e) =>
            setDesc(e.target.value)
          }
          placeholder="Describe the issue"
          rows={4}
          className="mt-2 w-full resize-none rounded-2xl border border-slate-200 p-4 text-sm text-slate-900 outline-none focus:border-primary-500 placeholder:text-slate-400"
        />


        {/* ==================================================
            DESTINATION INFORMATION
        ================================================== */}

        {destination && (
          <div className="mt-3 rounded-2xl bg-slate-50 p-3">

            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Reporting for
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-900">
              {destination.name}
            </p>

          </div>
        )}


        {/* ==================================================
            ERROR MESSAGE
        ================================================== */}

        {error && !loadingOptions && (
          <p className="mt-4 text-center text-sm text-danger-500">
            {error}
          </p>
        )}


        {/* ==================================================
            SUBMIT BUTTON
        ================================================== */}

        <div className="mt-6">

          <Button
            fullWidth
            disabled={
              !selected ||
              submitting ||
              loadingOptions
            }
            onClick={handleSubmit}
            className="text-lg"
          >
            {submitting
              ? 'Submitting...'
              : 'Submit Report'}
          </Button>

        </div>

      </div>


      {/* ======================================================
          SUCCESS OVERLAY
      ====================================================== */}

      {done && (
        <Overlay
          onClose={() =>
            setDone(false)
          }
        >

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
            Your report helps make navigation safer for everyone.
          </p>


          <div className="mt-6">

            <Button
              fullWidth
              onClick={() =>
                go('home')
              }
            >
              Done
            </Button>

          </div>

        </Overlay>
      )}

    </div>
  );
}