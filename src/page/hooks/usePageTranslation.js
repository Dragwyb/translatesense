import { useState, useCallback, useRef } from '@wordpress/element';
import { getEvaluatedProviders } from '../../services/providers/providerService';
import { extractPostStrings, markPostTranslated, translatePostServer } from '../services/pageTranslationService';
import { getCoreInstance } from '../../services/core/coreService';
import { isEmailOrUrl } from '../../utils/validation';
import { formatMs } from '../../utils/formatting';

function isTranslatedStringValid(item) {
  return Boolean(
    item &&
      !item.error &&
      item.status !== 'Failed' &&
      item.status !== 'Pending' &&
      item.translated !== null &&
      item.translated !== undefined &&
      String(item.translated).trim() !== ''
  );
}

function applyTranslationResult(list, result, core, providerId, options = {}) {
  const { saveToCore = false, useCustomFieldPackage = true } = options;
  const isSuccess = Boolean(
    result &&
      (result.isSuccess !== undefined
        ? result.isSuccess
        : (result.status !== 'AI Failed' &&
            result.translated !== null &&
            result.translated !== undefined &&
            String(result.translated).trim() !== ''))
  );

  return list.map((item) => {
    if (item.value === result?.source || (result?.hash && item.hash === result.hash)) {
      if (isSuccess) {
        if (saveToCore && core) {
          let packageName = item.name;
          if (useCustomFieldPackage && packageName && packageName.startsWith('custom_field') && item.key) {
            packageName = `custom_field_${item.key}`;
          }
          core.saveSourceString(packageName, item.value, packageName);
          core.saveTranslatedString(
            packageName,
            item.source,
            item.value,
            result.translated,
            providerId,
            packageName
          );
        }
        return {
          ...item,
          providerTranslated: result.translated,
          translated: result.translated,
          status: result.status || 'Completed',
          error: null,
        };
      }

      const prevValid =
        item.translated !== null && item.translated !== undefined && String(item.translated).trim() !== '';
      return {
        ...item,
        providerTranslated: prevValid ? item.providerTranslated : '',
        translated: prevValid ? item.translated : '',
        status: prevValid ? item.status : 'Failed',
        error: result?.error || 'Translation failed or empty',
      };
    }
    return item;
  });
}

export function usePageTranslation(config = {}) {
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isSourcePromptOpen, setIsSourcePromptOpen] = useState(null);
  const [errorModal, setErrorModal] = useState({ isOpen: false, title: '', message: '', errorObj: null });

  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState('openai');

  const [extractedStrings, setExtractedStrings] = useState([]);
  const [strings, setStrings] = useState([]);
  const [sourcePageData, setSourcePageData] = useState(null);

  // Failure tracking & retry state
  const [hasAttemptedTranslation, setHasAttemptedTranslation] = useState(false);
  const [isTranslationComplete, setIsTranslationComplete] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Progress overlay state
  const [progress, setProgress] = useState({
    isOpen: false,
    percent: 0,
    status: '',
    subText: '',
    isExtracting: false,
  });

  // Stats
  const [translationStats, setTranslationStats] = useState({
    timeTaken: '0.0s',
    timeTakenMs: 0,
    totalChars: 0,
    translatedChars: 0,
    stringCount: 0,
  });

  const [isCustomFieldsSyncEnabled, setIsCustomFieldsSyncEnabled] = useState(
    Boolean(
      config.isCustomFieldsSyncEnabled ||
      (typeof window !== 'undefined' &&
        (window.TranslateSenseEditorData?.isCustomFieldsSyncEnabled ||
          window.TranslateSenseBulkData?.isCustomFieldsSyncEnabled)) ||
      false
    )
  );
  const [skippedCustomFieldsCount, setSkippedCustomFieldsCount] = useState(0);

  const lastCompletedProviderRef = useRef('');
  const lastCompletedTargetLangRef = useRef('');

  const targetLang = config.targetLanguage || 'es';
  const sourceLang = config.sourceLanguage || config.defaultLanguage || 'en';
  const sourcePostId = config.sourcePostId || 0;
  const postId = config.postId || 0;
  const editorType = config.editorType || 'classic';

  // Load providers
  const loadProviders = useCallback(async () => {
    try {
      const list = await getEvaluatedProviders(sourceLang, targetLang);
      setProviders(list);

      const defaultProv = config.defaultProvider || '';
      let chosen = list.find((p) => p.isAvailable && p.id === defaultProv)?.id;
      if (!chosen) {
        chosen = list.find((p) => p.isAvailable)?.id || list[0]?.id || 'openai';
      }
      setSelectedProvider(chosen);
    } catch (err) {
      console.warn('[TranslateSense] Could not evaluate providers:', err);
    }
  }, [sourceLang, targetLang, config.defaultProvider]);

  // Check if translation is 100% completed in current session
  const isTranslationCompleted = useCallback(
    (providerId) => {
      const prov = providerId || selectedProvider;
      if (!prov || !Array.isArray(strings) || strings.length === 0) return false;
      if (
        lastCompletedProviderRef.current !== prov ||
        lastCompletedTargetLangRef.current !== targetLang
      ) {
        return false;
      }
      return strings.every((s) => s.translated !== null && s.translated !== undefined && String(s.translated).trim() !== '');
    },
    [selectedProvider, strings, targetLang]
  );

  // Extract strings and run translation
  const extractAndTranslate = useCallback(
    async (chosenProvider, forceRetranslate = false) => {
      const prov = chosenProvider || selectedProvider;
      const core = getCoreInstance();

      setIsReviewModalOpen(true);

      // If translation already complete and not retranslating, directly open review modal
      if (!forceRetranslate && isTranslationCompleted(prov)) {
        setIsTranslationComplete(true);
        return;
      }

      setIsTranslationComplete(false);

      if (forceRetranslate) {
        lastCompletedProviderRef.current = null;
        lastCompletedTargetLangRef.current = null;
      }

      if (!sourcePostId) return;

      setProgress({
        isOpen: forceRetranslate,
        percent: 0,
        status: forceRetranslate ? 'Preparing strings for re-translation...' : 'Extracting strings...',
        subText: 'Initializing translation...',
        isExtracting: !forceRetranslate,
      });

      // 1. Fetch sourcePageData if not present
      let pageData = sourcePageData;
      if (!pageData && core && typeof core.getPageContent === 'function') {
        try {
          pageData = await core.getPageContent(sourcePostId);
          setSourcePageData(pageData);
        } catch (e) {
          console.warn('[TranslateSense] Could not fetch source page data:', e);
        }
      }

      // 2. Fetch extracted strings
      let rawStrings = extractedStrings;
      if (!rawStrings || rawStrings.length === 0) {
        try {
          const res = await extractPostStrings(sourcePostId, editorType, targetLang);
          if (res && res.custom_fields_sync_enabled !== undefined) {
            setIsCustomFieldsSyncEnabled(Boolean(res.custom_fields_sync_enabled));
          }
          if (res && res.skipped_custom_fields_count !== undefined) {
            setSkippedCustomFieldsCount(Number(res.skipped_custom_fields_count) || 0);
          }
          const resStrings = Array.isArray(res.strings) ? res.strings : [];
          rawStrings = [];
          const allowedFields = {};

          resStrings.forEach(string => {
            if (!isEmailOrUrl(string.value || '')) {
              rawStrings.push(string);

              if (string.name.startsWith('custom_field')) {
                allowedFields[string.key] = { translate: true, source: string.source, value: string.value, fieldType: string.name };
              }
            }
          });

          if (Object.keys(allowedFields).length > 0) {
            setSourcePageData(prev => { return { ...prev, allowedFields } })
          }

          setExtractedStrings(rawStrings);

        } catch (err) {
          setProgress({ isOpen: false, percent: 0, status: '', subText: '', isExtracting: false });
          setIsReviewModalOpen(false);
          alert('Extraction Error: ' + (err.message || 'Unknown error'));
          return;
        }
      }

      // 3. Prepare initial strings array checking Core cache
      const currentStrings = rawStrings.map((s) => {
        let translated = '';
        let status = 'Pending';
        if (core && !forceRetranslate) {
          let packageName = s.name;

          if (packageName && packageName !== '' && packageName.startsWith('custom_field') && s.key) {
            packageName = `custom_field_${s.key}`;
          }

          const cached = core.getTranslatedString(packageName, s.value, null, packageName);
          if (cached && typeof cached === 'object' && cached.translate) {
            translated = cached.translate;
            status = 'Completed';
          } else if (typeof cached === 'string' && cached.trim() !== '') {
            translated = cached;
            status = 'Completed';
          }
        }
        return {
          ...s,
          providerTranslated: forceRetranslate ? '' : (s.providerTranslated || translated || ''),
          translated: forceRetranslate ? '' : translated,
          status,
        };
      });

      setStrings(currentStrings);

      // Check if all already translated (skip check if forceRetranslate)
      const allDone =
        !forceRetranslate &&
        currentStrings.length > 0 &&
        currentStrings.every((s) => s.translated && String(s.translated).trim() !== '');

      if (allDone) {
        lastCompletedProviderRef.current = prov;
        lastCompletedTargetLangRef.current = targetLang;
        setHasAttemptedTranslation(true);
        setIsTranslationComplete(true);
        setProgress({ isOpen: false, percent: 100, status: '', subText: '', isExtracting: false });
        setIsReviewModalOpen(true);
        return;
      }

      // 4. Perform translation batch
      const total = currentStrings.length;
      setProgress({
        isOpen: true,
        percent: 0,
        status: 'Translating strings...',
        subText: `0 of ${total} strings translated`,
        isExtracting: false,
      });

      const startTime = performance.now();
      const itemsToTranslate = currentStrings.map((s) => ({
        hash: s.hash,
        widget_id: s.name,
        field: s.key,
        source: s.source || s.value,
        content: s.value,
      }));
      let trackedStrings = currentStrings.map((s) => ({ ...s }));

      try {
        let translateResults = null;
        if (core) {
          translateResults = await core.translate(
            prov,
            {
              items: itemsToTranslate,
              sourceLang: sourceLang || 'en',
              targetLang,
              postId,
            },
            (result) => {
              trackedStrings = applyTranslationResult(trackedStrings, result, core, prov, {
                saveToCore: true,
                useCustomFieldPackage: true,
              });

              const completedCountNow = trackedStrings.filter(isTranslatedStringValid).length;
              const pct = Math.min(100, Math.max(15, Math.round((completedCountNow / total) * 100)));

              setStrings((prevList) =>
                applyTranslationResult(prevList, result, core, prov, {
                  saveToCore: false,
                  useCustomFieldPackage: true,
                })
              );

              setProgress({
                isOpen: true,
                percent: pct,
                status: `Translating strings... (${pct}%)`,
                subText: `${completedCountNow} of ${total} strings translated`,
                isExtracting: false,
              });
            }
          );
        }

        const elapsedMs = performance.now() - startTime;
        const totalSourceChars = currentStrings.reduce(
          (sum, s) => sum + String(s.value || '').length,
          0
        );
        const completedItems = trackedStrings.filter(isTranslatedStringValid);
        const completedCount = completedItems.length;
        const failedCount = trackedStrings.length - completedCount;
        const translatedChars = completedItems.reduce(
          (sum, s) => sum + String(s.value || '').length,
          0
        );
        const allSucceeded = Boolean(
          Array.isArray(translateResults) &&
            trackedStrings.length > 0 &&
            failedCount === 0
        );

        setTranslationStats({
          timeTaken: formatMs(elapsedMs),
          timeTakenMs: Math.round(elapsedMs),
          totalChars: totalSourceChars,
          translatedChars,
          stringCount: total,
        });

        if (allSucceeded) {
          setProgress({
            isOpen: true,
            percent: 100,
            status: '✓ Translation Completed (100%)',
            subText: `All ${total} strings translated successfully!`,
            isExtracting: false,
          });
          lastCompletedProviderRef.current = prov;
          lastCompletedTargetLangRef.current = targetLang;
        } else {
          const finalPct = Math.min(100, Math.max(15, Math.round((completedCount / total) * 100)));
          setProgress({
            isOpen: true,
            percent: finalPct,
            status: `Translation Completed (${completedCount}/${total})`,
            subText: `${completedCount} translated, ${failedCount} untranslated`,
            isExtracting: false,
          });
          lastCompletedProviderRef.current = null;
        }

        setIsTranslationComplete(allSucceeded);
        setHasAttemptedTranslation(true);

        setTimeout(() => {
          setProgress((p) => ({ ...p, isOpen: false }));
          setIsReviewModalOpen(true);
        }, allSucceeded ? 3000 : 2000);
      } catch (err) {
        setIsTranslationComplete(false);
        setHasAttemptedTranslation(true);
        setProgress((p) => ({ ...p, isOpen: false }));
        setIsReviewModalOpen(true);
        console.error('[TranslateSense] Translation Batch Error:', err);
      }
    },
    [
      selectedProvider,
      isTranslationCompleted,
      sourcePostId,
      sourcePageData,
      extractedStrings,
      editorType,
      targetLang,
      sourceLang,
      postId,
    ]
  );

  // Re-translate only failed, empty, or missing strings
  const retranslateFailed = useCallback(async () => {
    if (isRetrying) return;

    const prov = selectedProvider;
    if (prov !== 'openai' && prov !== 'gemini') return;

    // Collect ONLY untranslated or failed strings
    const failedStrings = strings.filter(
      (s) => s.translated === null || s.translated === undefined || String(s.translated).trim() === ''
    );

    if (failedStrings.length === 0) return;

    setIsRetrying(true);
    setIsTranslationComplete(false);
    const core = getCoreInstance();
    const totalFailed = failedStrings.length;

    setProgress({
      isOpen: true,
      percent: 0,
      status: `Re-translating ${totalFailed} untranslated string${totalFailed > 1 ? 's' : ''}...`,
      subText: `0 of ${totalFailed} retried`,
      isExtracting: false,
    });

    const itemsToRetry = failedStrings.map((s) => ({
      hash: s.hash,
      widget_id: s.name,
      field: s.key,
      source: s.source || s.value,
      content: s.value,
    }));
    let trackedStrings = strings.map((s) => ({ ...s }));

    try {
      let retriedCount = 0;
      let successfulRetryCount = 0;
      let retryResults = null;

      if (core) {
        retryResults = await core.translate(
          prov,
          {
            items: itemsToRetry,
            sourceLang: sourceLang || 'en',
            targetLang,
            postId,
          },
          (result) => {
            retriedCount++;
            const isSuccess = Boolean(
              result.isSuccess !== undefined
                ? result.isSuccess
                : (result.status !== 'AI Failed' && result.translated !== null && result.translated !== undefined && String(result.translated).trim() !== '')
            );

            if (isSuccess) {
              successfulRetryCount++;
            }

            trackedStrings = applyTranslationResult(trackedStrings, result, core, prov, {
              saveToCore: true,
              useCustomFieldPackage: false,
            });

            setStrings((prevList) =>
              applyTranslationResult(prevList, result, core, prov, {
                saveToCore: false,
                useCustomFieldPackage: false,
              })
            );

            const pct = Math.min(100, Math.max(15, Math.round((retriedCount / totalFailed) * 100)));
            setProgress((p) => ({
              ...p,
              isOpen: true,
              percent: pct,
              subText: `${retriedCount} of ${totalFailed} retried (${successfulRetryCount} succeeded)`,
            }));
          }
        );
      }

      const completedItems = trackedStrings.filter(isTranslatedStringValid);
      const remainingFailed = trackedStrings.length - completedItems.length;
      const allSuccess = Boolean(
        Array.isArray(retryResults) &&
          successfulRetryCount === totalFailed &&
          trackedStrings.length > 0 &&
          remainingFailed === 0
      );

      setTranslationStats((prev) => ({
        ...prev,
        translatedChars: completedItems.reduce((sum, s) => sum + String(s.value || '').length, 0),
      }));

      setProgress({
        isOpen: true,
        percent: 100,
        status: allSuccess ? '✓ All Strings Translated' : 'Retry Completed',
        subText: `${successfulRetryCount} of ${totalFailed} strings translated successfully`,
        isExtracting: false,
      });

      if (allSuccess) {
        lastCompletedProviderRef.current = prov;
        lastCompletedTargetLangRef.current = targetLang;
      }

      setIsTranslationComplete(allSuccess);

      setTimeout(() => {
        setProgress((p) => ({ ...p, isOpen: false }));
      }, 1800);
    } catch (err) {
      setIsTranslationComplete(false);
      console.error('[TranslateSense] Error during re-translation:', err);
      setProgress((p) => ({
        ...p,
        isOpen: false,
      }));
    } finally {
      setIsRetrying(false);
      setHasAttemptedTranslation(true);
    }
  }, [isRetrying, selectedProvider, strings, sourceLang, targetLang, postId]);

  // Derive visibility of the Re-Translate All button
  const isEligibleProvider = selectedProvider === 'openai' || selectedProvider === 'gemini';
  const untranslatedCount = Array.isArray(strings)
    ? strings.filter((s) => s.translated === null || s.translated === undefined || String(s.translated).trim() === '').length
    : 0;

  const showReTranslateAll = Boolean(
    hasAttemptedTranslation &&
    isEligibleProvider &&
    untranslatedCount > 0
  );

  // Apply translations to active editor
  const applyTranslationsToPage = useCallback(async () => {
    const core = getCoreInstance();

    // 1. Sync valid strings to Core
    if (core) {
      strings.forEach((s) => {
        if (s.translated !== null && s.translated !== undefined && String(s.translated).trim() !== '') {
          core.saveSourceString(s.name, s.value, s.name);
          core.saveTranslatedString(s.name, s.source || s.value, s.value, s.translated, selectedProvider, s.name);
        }
      });
    }

    // Apply content/meta strings through the active editor adapter.
    const res = await core.applyToPageEditor(editorType, {
      strings,
      sourcePageData,
      options: {
        provider: selectedProvider,
      },
    });

    setIsReviewModalOpen(false);

    // Complete post translation completion workflow via existing mark-translated route.
    if (postId) {
      const successfulStrings = strings.filter(isTranslatedStringValid);
      const isFullyCompleted = strings.length > 0 && successfulStrings.length === strings.length;
      const totalChars = isFullyCompleted
        ? successfulStrings.reduce((sum, s) => sum + String(s.value || '').length, 0)
        : 0;
      const totalStrs = isFullyCompleted ? successfulStrings.length : 0;

      markPostTranslated({
        post_id: postId,
        status: isFullyCompleted ? 'success' : 'incomplete',
        total_characters: totalChars,
        total_strings: totalStrs,
        provider: selectedProvider || 'openai',
        time_take: translationStats.timeTakenMs || 0,
      }).catch((err) => console.warn('[TranslateSense] Could not update stats:', err));
    }

    return res;
  }, [strings, selectedProvider, postId, translationStats, editorType, sourcePageData]);

  return {
    isProviderModalOpen,
    setIsProviderModalOpen,
    isReviewModalOpen,
    setIsReviewModalOpen,
    isSourcePromptOpen,
    setIsSourcePromptOpen,
    errorModal,
    setErrorModal,
    providers,
    loadProviders,
    selectedProvider,
    setSelectedProvider,
    strings,
    setStrings,
    progress,
    translationStats,
    extractAndTranslate,
    retranslateFailed,
    showReTranslateAll,
    isRetrying,
    isTranslationComplete,
    applyTranslationsToPage,
    isTranslationCompleted,
    targetLang,
    sourceLang,
    isCustomFieldsSyncEnabled,
    skippedCustomFieldsCount,
  };
}
