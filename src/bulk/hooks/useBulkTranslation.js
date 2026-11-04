import { useState, useEffect, useRef, useCallback } from '@wordpress/element';
import { getEvaluatedProviders } from '../../services/providers/providerService';
import { startBulkTranslation, updateBulkJob, skipBulkPost } from '../services/bulkService';
import { getActiveBatches, getBatchStatus } from '../services/batchService';
import { extractStrings, translatePost } from '../../services/core/translationService';
import { getCoreInstance } from '../../services/core/coreService';
import { isEmailOrUrl } from '../../utils/validation';
import { getPostProgress, getOverallProgress, calculateBatchStats } from '../utils/bulkCalculations';
import { useElapsedTimer } from './useElapsedTimer';

export function useBulkTranslation(initialPostIds = [], options = {}) {
  const isPreviouslyRunning = Boolean(options.isPreviouslyRunning);
  const targetBatchId = options.batchId || null;

  const [currentStep, setCurrentStep] = useState(isPreviouslyRunning ? 3 : 1);
  const [postIds, setPostIds] = useState(initialPostIds);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [providers, setProviders] = useState([]);

  const [activeBatches, setActiveBatches] = useState([]);
  const [currentBatchId, setCurrentBatchId] = useState(targetBatchId);
  const [currentBatch, setCurrentBatch] = useState(null);

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

  // Modals
  const [skipModal, setSkipModal] = useState({ isOpen: false, postId: null, batchId: null });
  const [errorModal, setErrorModal] = useState({ isOpen: false, title: '', message: '', errorObj: null });

  // Timer
  const { formattedTimer, humanReadable, startTimer, stopTimer, resetTimer } =
    useElapsedTimer(isTranslating);

  const pollTimerRef = useRef(null);
  const isPollingRef = useRef(false);

  // Load providers and active batches on mount
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

    getActiveBatches().then((res) => {
      if (!mounted) return;
      const batches = res.batches || [];
      setActiveBatches(batches);
      if (batches.length > 0 && !currentBatchId) {
        setCurrentBatchId(batches[0].batch_id);
        setCurrentBatch(batches[0]);
      }
    });

    return () => {
      mounted = false;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  // Populate map from batch
  const populateMapFromBatch = useCallback((batchData) => {
    if (!batchData || !Array.isArray(batchData.items)) return;

    setPostResultsMap((prev) => {
      const updated = { ...prev };
      batchData.items.forEach((item) => {
        const pId = String(item.post_id);
        const tLang = String(item.target_language);

        if (!updated[pId]) {
          updated[pId] = {
            postId: item.post_id,
            postTitle: item.post_title || `Post #${item.post_id}`,
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
          progressPercent: getPostProgress(item),
          progressStatus: item.progress_status || '',
          editUrl:
            item.edit_url ||
            (item.target_post_id ? `post.php?post=${item.target_post_id}&action=edit` : ''),
          viewUrl: item.view_url || (item.target_post_id ? `/?p=${item.target_post_id}` : ''),
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
  }, []);

  // Server background polling logic
  const pollStatus = useCallback(
    async (batchIdToPoll) => {
      const bId = batchIdToPoll || currentBatchId;
      if (!bId || isPollingRef.current) return;
      isPollingRef.current = true;

      try {
        const data = await getBatchStatus(bId);
        setCurrentBatch(data);

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
        setTotalJobsCount(data.total_jobs || 1);
        setStatusText(data.current_status || `Translating content in background... (${pct}%)`);

        populateMapFromBatch(data);

        if (
          data.overall_status === 'completed' ||
          data.overall_status === 'failed' ||
          data.overall_status === 'skipped'
        ) {
          setIsTranslating(false);
          setIsCompleted(true);
          stopTimer();

          const stats = calculateBatchStats(data.items || []);
          setStatsSummary(stats);
        } else {
          pollTimerRef.current = setTimeout(() => pollStatus(bId), 5000);
        }
      } catch (err) {
        console.warn('[TranslateSense] Bulk polling error:', err);
        pollTimerRef.current = setTimeout(() => pollStatus(bId), 5000);
      } finally {
        isPollingRef.current = false;
      }
    },
    [currentBatchId, populateMapFromBatch, stopTimer]
  );

  // Chrome Local AI Execution Workflow
  const runChromeAiTranslation = useCallback(
    async (jobsList, batchId) => {
      const core = getCoreInstance();
      const totalJobs = jobsList.length || 1;
      let completedCount = 0;
      let failedCount = 0;
      const extractedCache = {};

      // Track live state of each job for accurate, continuous overall progress calculations matching pollStatus
      const runningJobs = jobsList.map((job) => {
        const isExists = job.status === 'already_exists';
        if (isExists) {
          completedCount++;
        }
        return {
          id: job.id,
          post_id: job.post_id,
          target_language: job.target_language,
          status: isExists ? 'already_exists' : (job.status || 'pending'),
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
              postTitle: j.post_title || `Post #${pId}`,
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
      setProgressPercent(initialPct);
      setStatusText(
        initialPct > 0
          ? `Starting on-device translation... (${initialPct}%)`
          : 'Starting on-device translation...'
      );

      for (let i = 0; i < jobsList.length; i++) {
        const job = jobsList[i];
        const postId = String(job.post_id);
        const targetLang = String(job.target_language);
        const jobId = job.id;
        const postTitle = job.post_title || `Post #${postId}`;

        if (job.status === 'already_exists') {
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
            t.progressStatus = `Extracting strings for ${postTitle}...`;
            t.targetTitle = `Extracting strings for ${postTitle}...`;
            t.progressPercent = getPostProgress(runningJobs[i]);
            updated[postId].translations[targetLang] = t;
          }
          return updated;
        });

        setStatusText(`Extracting strings for ${postTitle} (${targetLang.toUpperCase()})... (${startJobPct}%)`);
        const jobStartTime = performance.now();
        let rawStrings = [];

        try {
          if (extractedCache[postId]) {
            rawStrings = extractedCache[postId];
          } else {
            const extRes = await extractStrings(postId);
            rawStrings = extRes.strings || [];
            extractedCache[postId] = rawStrings;
          }

          const translatable = rawStrings.filter(
            (s) => s.value && s.value.trim() && !isEmailOrUrl(s.value)
          );

          if (translatable.length === 0) {
            throw new Error('No translatable text found in post.');
          }

          const totalStrings = translatable.length;
          let completedStrings = 0;

          runningJobs[i].total_strings = totalStrings;
          runningJobs[i].completed_strings = 0;
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
                sourceLang: 'en',
                targetLang,
                postId,
              },
              (resItem) => {
                if (resItem && resItem.translated && resItem.hash) {
                  inMemoryTranslations[resItem.hash] = resItem.translated;
                }

                completedStrings++;
                runningJobs[i].completed_strings = completedStrings;
                runningJobs[i].total_strings = totalStrings;
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
              t.progressStatus = 'Saving translated post to WordPress...';
              t.targetTitle = 'Saving translated post to WordPress...';
              updated[postId].translations[targetLang] = t;
            }
            return updated;
          });

          const postRes = await translatePost({
            post_id: postId,
            target_lang: targetLang,
            provider: 'chrome_ai',
            in_memory_translations: inMemoryTranslations,
          });

          await updateBulkJob(jobId, {
            status: 'completed',
            progress_status: 'Completed successfully',
            total_strings: rawStrings.length,
            completed_strings: rawStrings.length,
            time_take: Math.round(performance.now() - jobStartTime),
            target_post_id: postRes.target_post_id,
          });

          runningJobs[i].status = 'completed';
          runningJobs[i].completed_strings = rawStrings.length;
          runningJobs[i].total_strings = rawStrings.length;

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
              t.completedStrings = rawStrings.length;
              t.totalStrings = rawStrings.length;
              t.progressPercent = 100;
              t.progressStatus = 'Completed successfully';
              updated[postId].translations[targetLang] = t;
            }
            return updated;
          });
        } catch (err) {
          failedCount++;
          console.error(`[TranslateSense] Chrome AI error for post #${postId}:`, err);

          runningJobs[i].status = 'failed';
          const postFailPct = Math.round(getOverallProgress(runningJobs));
          setProgressPercent(postFailPct);

          await updateBulkJob(jobId, {
            status: 'failed',
            progress_status: `Failed: ${err.message}`,
            error_message: err.message,
            total_strings: rawStrings.length || 0,
            time_take: Math.round(performance.now() - jobStartTime),
          });

          setPostResultsMap((prev) => {
            const updated = { ...prev };
            if (updated[postId] && updated[postId].translations[targetLang]) {
              const t = { ...updated[postId].translations[targetLang] };
              t.status = 'failed';
              t.error = err.message;
              t.progressPercent = 100;
              t.progressStatus = `Failed: ${err.message}`;
              t.targetTitle = `Failed: ${err.message}`;
              updated[postId].translations[targetLang] = t;
            }
            return updated;
          });
        }
      }

      setProgressPercent(100);
      setStatusText(
        failedCount > 0
          ? `Completed with ${failedCount} errors.`
          : 'All translations completed successfully!'
      );
      setIsTranslating(false);
      stopTimer();

      // Calculate final stats
      setPostResultsMap((finalMap) => {
        const allItems = [];
        Object.values(finalMap).forEach((p) => {
          Object.values(p.translations).forEach((t) => allItems.push(t));
        });
        setStatsSummary(calculateBatchStats(allItems));
        return finalMap;
      });

      await new Promise((resolve) => setTimeout(resolve, 3000));

      setIsCompleted(true);
    },
    [stopTimer]
  );

  // Start translation trigger from Step 2
  const startTranslation = useCallback(async () => {
    setCurrentStep(3);
    setIsTranslating(true);
    setIsCompleted(false);
    setProgressPercent(0);
    resetTimer();

    const isChromeAi = selectedProvider === 'chrome_ai';

    // Initialize map
    const initialMap = {};
    postIds.forEach((pid) => {
      const pidStr = String(pid);
      initialMap[pidStr] = {
        postId: pid,
        postTitle: `Post #${pid}`,
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
      });

      if (!batchRes.batch_id) {
        throw new Error(batchRes.message || 'Failed to start batch');
      }

      setCurrentBatchId(batchRes.batch_id);

      if (isChromeAi) {
        runChromeAiTranslation(batchRes.jobs || [], batchRes.batch_id);
      } else {
        pollStatus(batchRes.batch_id);
      }
    } catch (err) {
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
  };
}

