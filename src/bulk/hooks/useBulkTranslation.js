import { useState, useEffect, useRef, useCallback, useMemo } from '@wordpress/element';
import { getEvaluatedProviders } from '../../services/providers/providerService';
import { startBulkTranslation, translateBulkTerm, updateBulkJob, skipBulkPost } from '../services/bulkService';
import { getActiveBatches, getBatchStatus } from '../services/batchService';
import { extractStrings, translatePost } from '../../services/core/translationService';
import { getCoreInstance } from '../../services/core/coreService';
import { parseHideReviewNotice } from '../../services/api/reviewService';
import { isEmailOrUrl } from '../../utils/validation';
import { getPostProgress, getOverallProgress, calculateBatchStats } from '../utils/bulkCalculations';
import { useElapsedTimer } from './useElapsedTimer';

export function useBulkTranslation(initialPostIds = [], options = {}) {
  const isPreviouslyRunning = Boolean(options.isPreviouslyRunning);
  const targetBatchId = options.batchId || null;
  const bulkConfig =
    (typeof window !== 'undefined' && window.TranslateSenseBulkData) || {};
  const itemType =
    options.type === 'term' || options.type === 'post'
      ? options.type
      : (bulkConfig.type === 'term' ? 'term' : 'post');
  const subtype =
    options.subtype !== undefined ? options.subtype : (bulkConfig.subtype || '');
  const isTaxonomy = itemType === 'term';
  const rawSingular = bulkConfig.itemSingular || (isTaxonomy ? 'term' : 'post');
  const itemTitlePrefix = rawSingular.charAt(0).toUpperCase() + rawSingular.slice(1);

  const [currentStep, setCurrentStep] = useState(isPreviouslyRunning ? 3 : 1);
  const [postIds, setPostIds] = useState(initialPostIds);

  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [providers, setProviders] = useState([]);

  const [activeBatches, setActiveBatches] = useState([]);
  const [currentBatchId, setCurrentBatchId] = useState(targetBatchId);
  const [currentBatch, setCurrentBatch] = useState(null);
  const currentBatchIdRef = useRef(targetBatchId);

  useEffect(() => {
    currentBatchIdRef.current = currentBatchId;
  }, [currentBatchId]);

  const [postResultsMap, setPostResultsMap] = useState({});
  const [orderedPostIds, setOrderedPostIds] = useState([]);

  const [isTranslating, setIsTranslating] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [statusText, setStatusText] = useState('Initializing...');
  const [completedJobsCount, setCompletedJobsCount] = useState(0);
  const [totalJobsCount, setTotalJobsCount] = useState(0);

  const [statsSummary, setStatsSummary] = useState(null);
  const [filterOnlyFailed, setFilterOnlyFailed] = useState(false);
  const [hideReviewNotice, setHideReviewNotice] = useState(true);

  const handleDismissReviewNotice = useCallback(() => {
    setHideReviewNotice(true);
  }, []);

  // Modal progress session context: separates new user queue from existing background queue
  const [progressSessionType, setProgressSessionType] = useState('new_queue'); // 'new_queue' | 'existing_queue'
  const [progressModalSource, setProgressModalSource] = useState('provider_selection'); // 'provider_selection' | 'bulk_button' | 'language_selection_view_progress'

  // Modals
  const [skipModal, setSkipModal] = useState({ isOpen: false, postId: null, batchId: null });
  const [errorModal, setErrorModal] = useState({ isOpen: false, title: '', message: '', errorObj: null });

  // Timer
  const { formattedTimer, humanReadable, startTimer, stopTimer, resetTimer } =
    useElapsedTimer(isTranslating);

  const pollTimerRef = useRef(null);
  const isPollingRef = useRef(false);

  // Runtime browser detection: taxonomy runtime sessions and Chrome AI require keeping the window open
  const isQueueChromeAi = useMemo(() => {
    if (progressSessionType === 'new_queue') {
      return selectedProvider === 'chrome_ai' || isTaxonomy;
    }

    const activeBatch = currentBatch || (activeBatches && activeBatches.find((b) => b.batch_id === currentBatchId));
    if (activeBatch) {
      if (activeBatch.provider === 'chrome_ai' || activeBatch.provider === 'chrome_local_ai') {
        return true;
      }
      if (Array.isArray(activeBatch.items)) {
        const hasActiveChrome = activeBatch.items.some((item) => {
          const isChrome = item.provider === 'chrome_ai' || item.provider === 'chrome_local_ai';
          const isActive = item.status === 'pending' || item.status === 'running' || item.status === 'processing';
          return isChrome && isActive;
        });
        if (hasActiveChrome) return true;
      }
    }

    for (const post of Object.values(postResultsMap || {})) {
      if (post.provider === 'chrome_ai' || post.provider === 'chrome_local_ai') {
        const hasActiveTrans = Object.values(post.translations || {}).some(
          (t) => t.status === 'pending' || t.status === 'running' || t.status === 'processing'
        );
        if (hasActiveTrans) return true;
      }
      for (const t of Object.values(post.translations || {})) {
        const isChrome = t.provider === 'chrome_ai' || t.provider === 'chrome_local_ai';
        const isActive = t.status === 'pending' || t.status === 'running' || t.status === 'processing';
        if (isChrome && isActive) return true;
      }
    }

    return false;
  }, [progressSessionType, selectedProvider, isTaxonomy, currentBatch, activeBatches, currentBatchId, postResultsMap]);


  // Load providers and active background batches (posts only) on mount
  useEffect(() => {
    let mounted = true;

    getEvaluatedProviders('en', selectedLanguages[0] || 'es').then((list) => {
      if (!mounted) return;
      setProviders(list);

      const firstAvail = list.find((p) => p.isAvailable && p.statusMeta.isConnected);
      if (firstAvail) {
        setSelectedProvider(firstAvail.id);
      }
    });

    if (!isTaxonomy) {
      getActiveBatches().then((res) => {
        if (!mounted) return;
        const batches = res.batches || [];
        setActiveBatches(batches);
        if (batches.length > 0 && !currentBatchId) {
          setCurrentBatchId(batches[0].batch_id);
          setCurrentBatch(batches[0]);
        }
      });
    }

    return () => {
      mounted = false;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [isTaxonomy]);

  // Stop background polling timer
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    isPollingRef.current = false;
  }, []);

  // Populate map from batch
  const populateMapFromBatch = useCallback((batchData, replace = false) => {
    if (!batchData || !Array.isArray(batchData.items)) return;

    const firstItem = batchData.items[0];
    const batchIsTaxonomy =
      firstItem && firstItem.editor_type
        ? firstItem.editor_type === 'taxonomy'
        : isTaxonomy;
    const prefix =
      batchIsTaxonomy === isTaxonomy
        ? itemTitlePrefix
        : (batchIsTaxonomy ? 'Term' : 'Post');

    setPostResultsMap((prev) => {
      const updated = replace ? {} : { ...prev };
      batchData.items.forEach((item) => {
        const pId = String(item.post_id);
        const tLang = String(item.target_language);

        if (!updated[pId]) {
          updated[pId] = {
            postId: item.post_id,
            postTitle: item.post_title || `${prefix} #${item.post_id}`,
            provider: item.provider || batchData.provider || 'openai',
            translations: {},
          };
        }
        if (item.post_title) updated[pId].postTitle = item.post_title;

        updated[pId].translations[tLang] = {
          targetLang: item.target_language,
          targetPostId: item.target_post_id,
          targetTitle:
            item.target_post_title ||
            (item.status === 'already_exists' || item.status === 'completed'
              ? item.target_post_title || item.post_title
              : item.progress_status || 'Processing...'),
          editorType: item.editor_type,
          status: item.status,
          completedStrings: item.completed_strings,
          totalStrings: item.total_strings,
          completedCharacters: item.completed_characters || (item.completed_strings ? item.completed_strings * 45 : 0),
          totalCharacters: item.total_characters || (item.total_strings ? item.total_strings * 45 : 0),
          progressPercent: getPostProgress(item),
          progressStatus: item.progress_status || '',
          editUrl: item.edit_url,
          viewUrl: item.view_url,
          error: item.error_message,
          provider: item.provider || batchData.provider,
        };
      });

      return updated;
    });

    const itemsOrder = [];
    batchData.items.forEach((it) => {
      const pidStr = String(it.post_id);
      if (!itemsOrder.includes(pidStr)) itemsOrder.push(pidStr);
    });
    setOrderedPostIds(itemsOrder);
  }, [isTaxonomy, itemTitlePrefix]);

  // Server background polling logic
  const pollStatus = useCallback(
    async (batchIdToPoll) => {
      const bId = batchIdToPoll || currentBatchIdRef.current;
      if (!bId) return;

      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }

      if (isPollingRef.current) return;
      isPollingRef.current = true;

      try {
        const data = await getBatchStatus(bId);

        // Discard result if user switched to another batch in the meantime
        if (currentBatchIdRef.current && currentBatchIdRef.current !== bId) {
          return;
        }

        setCurrentBatch(data);
        setCurrentBatchId(bId);
        currentBatchIdRef.current = bId;

        const pct =
          Array.isArray(data.items) && data.items.length > 0
            ? Math.round(getOverallProgress(data.items))
            : Math.round(data.progress_percent || 0);

        setProgressPercent(pct);
        const done =
          (data.completed_jobs || 0) +
          (data.already_exists_jobs || 0) +
          (data.skipped_jobs || 0);
        setCompletedJobsCount(done);
        setTotalJobsCount(data.total_jobs || (data.items ? data.items.length : 1));
        setStatusText(data.current_status || `Translating content in background... (${pct}%)`);

        populateMapFromBatch(data, false);

        const isFinished =
          data.overall_status === 'completed' ||
          data.overall_status === 'failed' ||
          data.overall_status === 'skipped' ||
          data.overall_status === 'cancelled';

        if (isFinished) {
          setIsTranslating(false);
          setIsCompleted(true);
          stopTimer();

          const stats = calculateBatchStats(data.items || []);
          setStatsSummary(stats);

          // Continue polling only while active batches exist; stop immediately if all finished
          try {
            const res = await getActiveBatches();
            const remaining = res.batches || [];
            setActiveBatches(remaining);
            if (remaining.length === 0) {
              // No more active batches: stop polling immediately, do not schedule another request
              return;
            }
          } catch {
            return;
          }
        } else {
          setIsTranslating(true);
          setIsCompleted(false);
          startTimer();
          // Active batches exist: continue polling using 5000ms interval
          pollTimerRef.current = setTimeout(() => pollStatus(bId), 5000);
        }
      } catch (err) {
        console.warn('[TranslateSense] Bulk polling error:', err);
        try {
          const res = await getActiveBatches();
          const remaining = res.batches || [];
          setActiveBatches(remaining);
          if (remaining.length > 0 && remaining.some((b) => b.batch_id === bId)) {
            pollTimerRef.current = setTimeout(() => pollStatus(bId), 5000);
          } else {
            setIsTranslating(false);
            stopTimer();
          }
        } catch {
          setIsTranslating(false);
          stopTimer();
        }
      } finally {
        isPollingRef.current = false;
      }
    },
    [populateMapFromBatch, startTimer, stopTimer]
  );

  // Monitor mode activator: immediately enters Step 3 with populated batch data
  const openBatchMonitor = useCallback(
    async (targetBatchId = null, initialBatchData = null, allBatches = null, contextOptions = {}) => {
      stopPolling();

      const sessionType = contextOptions.sessionType || 'existing_queue';
      const modalSource = contextOptions.modalSource || 'bulk_button';
      setProgressSessionType(sessionType);
      setProgressModalSource(modalSource);

      setCurrentStep(2);

      let bId = targetBatchId || currentBatchIdRef.current;
      let data = initialBatchData;

      if (allBatches && Array.isArray(allBatches)) {
        setActiveBatches(allBatches);
      }

      // If missing batch ID or data, trigger /bulk-active-batches immediately once
      if (!bId || !data) {
        try {
          const res = await getActiveBatches();
          const batches = res.batches || [];
          setActiveBatches(batches);

          // If the response contains an empty batches array, stop polling immediately.
          // Do not schedule another request when there are no active batches.
          if (batches.length === 0) {
            setIsTranslating(false);
            setIsCompleted(false);
            setStatsSummary(null);
            stopTimer();
            setStatusText('No active translation batches.');
            return;
          }

          bId = bId || batches[0].batch_id;
          data = data || batches.find((b) => b.batch_id === bId) || batches[0];
        } catch (e) {
          console.warn('[TranslateSense] Failed to fetch active batches on openBatchMonitor:', e);
          setIsTranslating(false);
          stopTimer();
          return;
        }
      }

      if (bId) {
        setCurrentBatchId(bId);
        currentBatchIdRef.current = bId;

        if (data) {
          setCurrentBatch(data);
          // Immediately populate posts and items table
          populateMapFromBatch(data, true);

          const isFinished =
            data.overall_status === 'completed' ||
            data.overall_status === 'failed' ||
            data.overall_status === 'skipped' ||
            data.overall_status === 'cancelled';

          if (isFinished) {
            setIsTranslating(false);
            setIsCompleted(true);
            stopTimer();
            const stats = calculateBatchStats(data.items || []);
            setStatsSummary(stats);
            // Completed batch: do not schedule polling
            return;
          } else {
            setIsTranslating(true);
            setIsCompleted(false);
            startTimer();
          }

          const pct =
            Array.isArray(data.items) && data.items.length > 0
              ? Math.round(getOverallProgress(data.items))
              : Math.round(data.progress_percent || 0);

          setProgressPercent(pct);
          const done =
            (data.completed_jobs || 0) +
            (data.already_exists_jobs || 0) +
            (data.skipped_jobs || 0);
          setCompletedJobsCount(done);
          setTotalJobsCount(data.total_jobs || (data.items ? data.items.length : 1));
          setStatusText(
            data.current_status || `Translating content in background... (${pct}%)`
          );
        } else {
          setIsTranslating(true);
          setIsCompleted(false);
          startTimer();
        }

        // Start live polling cycle
        pollStatus(bId);
      }
    },
    [populateMapFromBatch, pollStatus, startTimer, stopTimer, stopPolling]
  );

  // Switch between multiple background batches preserving session context
  const switchBatch = useCallback(
    (newBatchId) => {
      if (!newBatchId) return;
      const batchData = activeBatches.find((b) => b.batch_id === newBatchId) || null;
      openBatchMonitor(newBatchId, batchData, activeBatches, {
        sessionType: progressSessionType,
        modalSource: progressModalSource,
      });
    },
    [activeBatches, openBatchMonitor, progressSessionType, progressModalSource]
  );

  // Auto-open monitor if options.isPreviouslyRunning is true
  useEffect(() => {
    if (isPreviouslyRunning) {
      openBatchMonitor(targetBatchId);
    }
  }, [isPreviouslyRunning, targetBatchId, openBatchMonitor]);

  // Runtime Browser Execution Workflow (Chrome AI & taxonomy runtime batches)
  const runChromeAiTranslation = useCallback(
    async (jobsList, batchId, providerOverride = null) => {
      const activeProvider = providerOverride || selectedProvider || 'chrome_ai';
      const useBrowserAi = activeProvider === 'chrome_ai';
      const core = useBrowserAi ? getCoreInstance() : null;
      const totalJobs = jobsList.length || 1;
      let completedCount = 0;
      let failedCount = 0;
      const extractedCache = {};

      // Track live state of each job for accurate, continuous overall progress calculations matching pollStatus
      const runningJobs = jobsList.map((job) => {
        const isResolvedSkip = job.status === 'already_exists' || job.status === 'skipped';
        if (isResolvedSkip) {
          completedCount++;
        }
        return {
          id: job.id,
          post_id: job.post_id,
          target_language: job.target_language,
          status: job.status || 'pending',
          total_strings: Number(job.total_strings) || 0,
          completed_strings: Number(job.completed_strings) || 0,
        };
      });

      // Synchronize initial batch jobs info into postResultsMap
      setPostResultsMap((prev) => {
        const updated = { ...prev };
        jobsList.forEach((j) => {
          const pId = String(j.post_id);
          const tLang = String(j.target_language);
          if (!updated[pId]) {
            updated[pId] = {
              postId: j.post_id,
              postTitle: j.post_title || `${itemTitlePrefix} #${pId}`,
              provider: j.provider || 'chrome_ai',
              translations: {},
            };
          } else if (j.post_title) {
            updated[pId].postTitle = j.post_title;
          }

          const existingTrans = updated[pId].translations[tLang] || {};
          updated[pId].translations[tLang] = {
            ...existingTrans,
            targetLang: j.target_language,
            targetPostId: j.target_post_id || existingTrans.targetPostId || null,
            targetTitle:
              j.status === 'already_exists'
                ? (j.target_post_title || j.post_title || existingTrans.targetTitle || '')
                : (existingTrans.targetTitle || ''),
            editorType: j.editor_type || existingTrans.editorType,
            status: j.status || existingTrans.status || 'pending',
            completedStrings: j.completed_strings || existingTrans.completedStrings || 0,
            totalStrings: j.total_strings || existingTrans.totalStrings || 0,
            progressPercent: getPostProgress(j),
            progressStatus: j.progress_status || existingTrans.progressStatus || '',
            editUrl: j.edit_url || existingTrans.editUrl || '',
            viewUrl: j.view_url || existingTrans.viewUrl || '',
            error: j.error_message || existingTrans.error || '',
            provider: j.provider || 'chrome_ai',
          };
        });
        return updated;
      });

      setCompletedJobsCount(completedCount);
      setTotalJobsCount(totalJobs);

      const initialPct = Math.round(getOverallProgress(runningJobs));
      const runtimeLabel = useBrowserAi ? 'on-device translation' : 'translation';
      setProgressPercent(initialPct);
      setStatusText(
        initialPct > 0
          ? `Starting ${runtimeLabel}... (${initialPct}%)`
          : `Starting ${runtimeLabel}...`
      );

      for (let i = 0; i < jobsList.length; i++) {
        const job = jobsList[i];
        const postId = String(job.post_id);
        const targetLang = String(job.target_language);
        const jobId = job.id;
        const postTitle = job.post_title || `${itemTitlePrefix} #${postId}`;

        if (job.status === 'already_exists' || job.status === 'skipped') {
          continue;
        }

        // If queue post is more than 1 day old, mark status as failed and do not translate
        const jobCreated = job.created_at ? new Date(job.created_at).getTime() : 0;
        const isOneDayOld = jobCreated > 0 && (Date.now() - jobCreated) >= 86400000;
        if (isOneDayOld) {
          failedCount++;
          runningJobs[i].status = 'failed';
          await updateBulkJob(jobId, {
            status: 'failed',
            progress_status: 'Failed: Job expired (more than 1 day old)',
            error_message: 'Translation job expired: queued for more than 1 day.',
          }, itemType);
          setPostResultsMap((prev) => {
            const updated = { ...prev };
            if (updated[postId] && updated[postId].translations[targetLang]) {
              const t = { ...updated[postId].translations[targetLang] };
              t.status = 'failed';
              t.error = 'Translation job expired: queued for more than 1 day.';
              t.progressPercent = 100;
              t.progressStatus = 'Failed: Job expired (more than 1 day old)';
              t.targetTitle = 'Failed: Job expired (more than 1 day old)';
              updated[postId].translations[targetLang] = t;
            }
            return updated;
          });
          continue;
        }

        // Mark running in state and recalculate overall progress
        runningJobs[i].status = 'running';
        const startJobPct = Math.round(getOverallProgress(runningJobs));
        setProgressPercent(startJobPct);

        setPostResultsMap((prev) => {
          const updated = { ...prev };
          if (updated[postId] && updated[postId].translations[targetLang]) {
            const t = { ...updated[postId].translations[targetLang] };
            t.status = 'running';
            t.progressStatus = isTaxonomy && !useBrowserAi
              ? `Translating ${postTitle}...`
              : `Extracting strings for ${postTitle}...`;
            t.targetTitle = t.progressStatus;
            t.progressPercent = getPostProgress(runningJobs[i]);
            updated[postId].translations[targetLang] = t;
          }
          return updated;
        });

        const jobStartTime = performance.now();
        let rawStrings = [];
        let postRes = null;
        let totalStringsCount = 0;
        let completedStringsCount = 0;
        let totalCharacters = 0;
        let sentStrings = [];

        try {
          if (isTaxonomy && !useBrowserAi) {
            setStatusText(`Translating ${postTitle} (${targetLang.toUpperCase()})... (${startJobPct}%)`);

            postRes = await translateBulkTerm({
              term_id: Number(postId),
              taxonomy: subtype,
              target_lang: targetLang,
              provider: activeProvider,
            });

            totalStringsCount = Number(postRes.total_strings) || 0;
            completedStringsCount = totalStringsCount;
            totalCharacters = Number(postRes.total_characters) || 0;
            sentStrings = Array.isArray(postRes.sent_data) ? postRes.sent_data : [];
          } else {
            setStatusText(`Extracting strings for ${postTitle} (${targetLang.toUpperCase()})... (${startJobPct}%)`);
            let sourceLanguage = 'en';
            let itemTaxonomy = isTaxonomy ? subtype : '';
            let itemIsTaxonomy = isTaxonomy;

            const extractionKey = `${postId}:${targetLang}`;
            if (extractedCache[extractionKey]) {
              rawStrings = extractedCache[extractionKey].strings || [];
              sourceLanguage = extractedCache[extractionKey].sourceLanguage || 'en';
              itemTaxonomy = extractedCache[extractionKey].taxonomy || itemTaxonomy;
              itemIsTaxonomy = extractedCache[extractionKey].isTaxonomy;
            } else {
              const extRes = await extractStrings(postId, '', targetLang, {
                type: itemType,
                subtype,
                includeTaxonomies: !isTaxonomy,
              });
              rawStrings = extRes.strings || [];
              sourceLanguage = extRes.source_language || 'en';
              itemIsTaxonomy = extRes.editor_type === 'taxonomy' || isTaxonomy;
              itemTaxonomy = extRes.taxonomy || itemTaxonomy;
              extractedCache[extractionKey] = {
                strings: rawStrings,
                sourceLanguage,
                taxonomy: itemTaxonomy,
                isTaxonomy: itemIsTaxonomy,
              };
            }

            const translatable = rawStrings.filter(
              (s) => s.value && s.value.trim() && !isEmailOrUrl(s.value)
            );

            if (translatable.length === 0) {
              console.error(`No translatable text found in ${itemIsTaxonomy ? 'taxonomy term' : 'post'}.`);
            }

            if (useBrowserAi && core) {
              const chromeProvider =
                typeof core.getProvider === 'function' ? core.getProvider('chrome_ai') : null;
              if (!chromeProvider) {
                throw new Error('Built-in AI translation provider is not registered.');
              }

              if (
                typeof chromeProvider.isLanguageSupported === 'function' &&
                !chromeProvider.isLanguageSupported(sourceLanguage, targetLang)
              ) {
                const err = new Error(
                  `Language pair (${sourceLanguage.toUpperCase()} → ${targetLang.toUpperCase()}) is not supported by ${chromeProvider.title || 'Built-in AI'}.`
                );
                err.errorObj = { reason: err.message };
                throw err;
              }

              if (typeof chromeProvider.checkAvailability === 'function') {
                const availability = await chromeProvider.checkAvailability(sourceLanguage, targetLang);
                if (availability && availability.available === false) {
                  const reasonMsg =
                    availability.reason ||
                    `Language pair (${sourceLanguage.toUpperCase()} → ${targetLang.toUpperCase()}) is not supported by ${chromeProvider.title || 'Built-in AI'}.`;
                  const err = new Error(reasonMsg);
                  err.errorObj = availability;
                  throw err;
                }
              }
            }

            const totalStrings = translatable.length;
            totalCharacters = translatable.reduce(
              (acc, s) => acc + (s.value ? s.value.length : 0),
              0
            );
            let completedStrings = 0;
            let completedCharacters = 0;

            runningJobs[i].total_strings = totalStrings;
            runningJobs[i].completed_strings = 0;
            runningJobs[i].total_characters = totalCharacters;
            runningJobs[i].completed_characters = 0;
            runningJobs[i].status = 'running';

            const extractDonePct = Math.round(getOverallProgress(runningJobs));
            setProgressPercent(extractDonePct);
            setStatusText(
              `Translating ${totalStrings} strings on-device for ${postTitle} (${targetLang.toUpperCase()})... (${extractDonePct}%)`
            );

            setPostResultsMap((prev) => {
              const updated = { ...prev };
              if (updated[postId] && updated[postId].translations[targetLang]) {
                const t = { ...updated[postId].translations[targetLang] };
                t.status = 'running';
                t.totalStrings = totalStrings;
                t.completedStrings = 0;
                t.totalCharacters = totalCharacters;
                t.completedCharacters = 0;
                t.progressPercent = getPostProgress(runningJobs[i]);
                t.progressStatus = `0/${totalStrings} strings translated`;
                t.targetTitle = `Translating 0/${totalStrings} strings...`;
                updated[postId].translations[targetLang] = t;
              }
              return updated;
            });

            const inMemoryTranslations = {};
            const itemsToTranslate = translatable.map((s) => ({
              hash: s.hash,
              widget_id: s.name,
              field: s.key,
              content: s.value,
            }));

            if (core) {
              await core.translate(
                'chrome_ai',
                {
                  items: itemsToTranslate,
                  sourceLang: sourceLanguage,
                  targetLang,
                  postId,
                },
                (resItem) => {
                  if (resItem && resItem.translated && resItem.hash) {
                    inMemoryTranslations[resItem.hash] = resItem.translated;
                  }

                  completedStrings++;
                  const orig = translatable.find((s) => s.hash === resItem?.hash);
                  if (orig && orig.value) {
                    completedCharacters += orig.value.length;
                  } else if (resItem && resItem.source) {
                    completedCharacters += resItem.source.length;
                  }

                  runningJobs[i].completed_strings = completedStrings;
                  runningJobs[i].total_strings = totalStrings;
                  runningJobs[i].completed_characters = completedCharacters;
                  runningJobs[i].total_characters = totalCharacters;
                  runningJobs[i].status = 'running';

                  const postPct = getPostProgress(runningJobs[i]);
                  const overallPct = Math.round(getOverallProgress(runningJobs));

                  setProgressPercent(overallPct);
                  setStatusText(
                    `Translating on-device: ${postTitle} (${targetLang.toUpperCase()}) - string ${completedStrings} of ${totalStrings} (${overallPct}%)`
                  );

                  setPostResultsMap((prev) => {
                    const updated = { ...prev };
                    if (updated[postId] && updated[postId].translations[targetLang]) {
                      const t = { ...updated[postId].translations[targetLang] };
                      t.status = 'running';
                      t.completedStrings = completedStrings;
                      t.totalStrings = totalStrings;
                      t.completedCharacters = completedCharacters;
                      t.totalCharacters = totalCharacters;
                      t.progressPercent = postPct;
                      t.progressStatus = `Translating string ${completedStrings} of ${totalStrings} (${postPct}%)`;
                      t.targetTitle = `Translating string ${completedStrings} of ${totalStrings} (${postPct}%)...`;
                      updated[postId].translations[targetLang] = t;
                    }
                    return updated;
                  });
                }
              );
            }

            setStatusText(`Saving ${postTitle} (${targetLang.toUpperCase()}) to WordPress...`);

            setPostResultsMap((prev) => {
              const updated = { ...prev };
              if (updated[postId] && updated[postId].translations[targetLang]) {
                const t = { ...updated[postId].translations[targetLang] };
                t.progressStatus = itemIsTaxonomy
                  ? 'Saving translated term to WordPress...'
                  : 'Saving translated post to WordPress...';
                t.targetTitle = t.progressStatus;
                updated[postId].translations[targetLang] = t;
              }
              return updated;
            });

            postRes = itemIsTaxonomy
              ? await translateBulkTerm({
                term_id: Number(postId),
                taxonomy: itemTaxonomy,
                target_lang: targetLang,
                provider: 'chrome_ai',
                in_memory_translations: inMemoryTranslations,
              })
              : await translatePost({
                post_id: postId,
                target_lang: targetLang,
                provider: 'chrome_ai',
                in_memory_translations: inMemoryTranslations,
                include_taxonomies: true,
              });

            totalStringsCount = rawStrings.length;
            completedStringsCount = rawStrings.length;
            sentStrings = translatable.map((s) => s.value);
          }

          await updateBulkJob(jobId, {
            status: 'completed',
            progress_status: 'Completed successfully',
            total_strings: totalStringsCount,
            completed_strings: completedStringsCount,
            total_characters: totalCharacters,
            completed_characters: totalCharacters,
            sent_data: sentStrings,
            time_take: Math.round(performance.now() - jobStartTime),
            target_post_id: postRes.target_post_id,
          }, itemType);

          runningJobs[i].status = 'completed';
          runningJobs[i].completed_strings = completedStringsCount;
          runningJobs[i].total_strings = totalStringsCount;
          runningJobs[i].completed_characters = totalCharacters;
          runningJobs[i].total_characters = totalCharacters;

          completedCount++;
          setCompletedJobsCount(completedCount);

          const postFinishPct = Math.round(getOverallProgress(runningJobs));
          setProgressPercent(postFinishPct);

          setPostResultsMap((prev) => {
            const updated = { ...prev };
            if (updated[postId] && updated[postId].translations[targetLang]) {
              const t = { ...updated[postId].translations[targetLang] };
              t.status = 'completed';
              t.targetPostId = postRes.target_post_id;
              t.targetTitle = postRes.translated_title || postTitle;
              t.editUrl = postRes.edit_url;
              t.viewUrl = postRes.view_url;
              t.completedStrings = completedStringsCount;
              t.totalStrings = totalStringsCount;
              t.completedCharacters = totalCharacters;
              t.totalCharacters = totalCharacters;
              t.progressPercent = 100;
              t.progressStatus = 'Completed successfully';
              updated[postId].translations[targetLang] = t;
            }
            return updated;
          });
        } catch (err) {
          failedCount++;

          runningJobs[i].status = 'failed';
          const postFailPct = Math.round(getOverallProgress(runningJobs));
          setProgressPercent(postFailPct);

          await updateBulkJob(jobId, {
            status: 'failed',
            progress_status: `Failed: ${err.message}`,
            error_message: err.message,
            total_strings: rawStrings.length || 0,
            time_take: Math.round(performance.now() - jobStartTime),
          }, itemType);

          setPostResultsMap((prev) => {
            const updated = { ...prev };
            if (updated[postId] && updated[postId].translations[targetLang]) {
              const t = { ...updated[postId].translations[targetLang] };
              t.status = 'failed';
              t.error = err.message;
              t.errorObj = err.errorObj || null;
              t.progressPercent = 100;
              t.progressStatus = `Failed: ${err.message}`;
              t.targetTitle = `Failed: ${err.message}`;
              updated[postId].translations[targetLang] = t;
            }
            return updated;
          });
        }
      }

      const hasRunnableJobs = runningJobs.some(
        (job) => job.status === 'completed' || job.status === 'failed'
      );

      setProgressPercent(100);
      setStatusText(
        failedCount > 0
          ? `Completed with ${failedCount} errors.`
          : hasRunnableJobs
            ? 'All translations completed successfully!'
            : 'All selected translations already exist.'
      );
      setIsTranslating(false);
      stopTimer();

      // Calculate final stats from tracked jobs
      setStatsSummary(calculateBatchStats(runningJobs));

      if (hasRunnableJobs) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      setIsCompleted(true);
    },
    [stopTimer, itemType, subtype, isTaxonomy, itemTitlePrefix, selectedProvider]
  );

  // Start translation trigger from Step 2
  const startTranslation = useCallback(async () => {
    setProgressSessionType('new_queue');
    setProgressModalSource('provider_selection');
    setCurrentStep(2);
    setIsTranslating(true);
    setIsCompleted(false);
    setCurrentBatch(null);
    setStatsSummary(null);
    setHideReviewNotice(true);
    setProgressPercent(0);
    resetTimer();

    const isChromeAi = selectedProvider === 'chrome_ai';

    // Initialize map
    const initialMap = {};
    postIds.forEach((pid) => {
      const pidStr = String(pid);
      initialMap[pidStr] = {
        postId: pid,
        postTitle: `${itemTitlePrefix} #${pid}`,
        provider: selectedProvider,
        translations: {},
      };
      selectedLanguages.forEach((lang) => {
        initialMap[pidStr].translations[lang] = {
          targetLang: lang,
          targetPostId: null,
          targetTitle: '',
          status: 'pending',
          completedStrings: 0,
          totalStrings: 0,
          editUrl: '',
          viewUrl: '',
          error: '',
          provider: selectedProvider,
        };
      });
    });

    setPostResultsMap(initialMap);
    setOrderedPostIds(postIds.map(String));
    setTotalJobsCount(postIds.length * selectedLanguages.length);
    setCompletedJobsCount(0);

    try {
      const batchRes = await startBulkTranslation({
        post_ids: postIds,
        target_languages: selectedLanguages,
        provider: selectedProvider,
        type: itemType,
        subtype,
      });

      setHideReviewNotice(parseHideReviewNotice(batchRes));

      setCurrentBatchId(batchRes.batch_id);

      if (Array.isArray(batchRes.jobs) && batchRes.jobs.length > 0) {
        populateMapFromBatch(
          {
            subtype: batchRes.subtype || subtype,
            provider: selectedProvider,
            items: batchRes.jobs,
          },
          true
        );
        setTotalJobsCount(batchRes.jobs.length);
        setCompletedJobsCount(
          batchRes.jobs.filter(
            (j) =>
              j.status === 'completed' ||
              j.status === 'already_exists' ||
              j.status === 'skipped'
          ).length
        );
        setProgressPercent(Math.round(getOverallProgress(batchRes.jobs)));
      }

      if (isChromeAi || isTaxonomy) {
        runChromeAiTranslation(batchRes.jobs || [], batchRes.batch_id, selectedProvider);
      } else {
        pollStatus(batchRes.batch_id);
      }
    } catch (err) {
      setHideReviewNotice(true);
      setIsTranslating(false);
      setStatusText(`Error: ${err.message}`);
      setErrorModal({
        isOpen: true,
        title: 'Batch Creation Error',
        message: err.message,
      });
    }
  }, [
    postIds,
    selectedLanguages,
    selectedProvider,
    itemType,
    subtype,
    isTaxonomy,
    itemTitlePrefix,
    populateMapFromBatch,
    resetTimer,
    runChromeAiTranslation,
    pollStatus,
  ]);

  // Handle Skip Action
  const handleSkipPost = useCallback(
    async (postId, batchId) => {
      setSkipModal({ isOpen: false, postId: null, batchId: null });
      try {
        await skipBulkPost(batchId || currentBatchId, postId);
        pollStatus(batchId || currentBatchId);
      } catch (err) {
        setErrorModal({
          isOpen: true,
          title: 'Skip Failed',
          message: err.message || 'Could not skip translations.',
        });
      }
    },
    [currentBatchId, pollStatus]
  );

  return {
    currentStep,
    setCurrentStep,
    postIds,
    setPostIds,
    selectedLanguages,
    setSelectedLanguages,
    selectedProvider,
    setSelectedProvider,
    providers,
    activeBatches,
    currentBatchId,
    setCurrentBatchId,
    currentBatch,
    postResultsMap,
    orderedPostIds,
    isTranslating,
    isCompleted,
    progressPercent,
    statusText,
    completedJobsCount,
    totalJobsCount,
    formattedTimer,
    humanReadableTimer: humanReadable,
    statsSummary,
    filterOnlyFailed,
    setFilterOnlyFailed,
    startTranslation,
    skipModal,
    setSkipModal,
    errorModal,
    setErrorModal,
    handleSkipPost,
    pollStatus,
    openBatchMonitor,
    switchBatch,
    stopPolling,
    populateMapFromBatch,
    setActiveBatches,
    progressSessionType,
    setProgressSessionType,
    progressModalSource,
    setProgressModalSource,
    isQueueChromeAi,
    hideReviewNotice,
    handleDismissReviewNotice,
  };
}

