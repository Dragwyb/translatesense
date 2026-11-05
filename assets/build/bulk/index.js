/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/bulk/BulkApp.jsx"
/*!******************************!*\
  !*** ./src/bulk/BulkApp.jsx ***!
  \******************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   BulkApp: () => (/* binding */ BulkApp)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _components_BulkWizard__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./components/BulkWizard */ "./src/bulk/components/BulkWizard.jsx");
/* harmony import */ var _hooks_useBulkTranslation__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./hooks/useBulkTranslation */ "./src/bulk/hooks/useBulkTranslation.js");
/* harmony import */ var _services_batchService__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./services/batchService */ "./src/bulk/services/batchService.js");

/**
 * BulkApp Component
 * Root component for Bulk Translation
 */





function BulkApp() {
  const [isOpen, setIsOpen] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
  const [hasActiveJobs, setHasActiveJobs] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
  const [selectedPostIds, setSelectedPostIds] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)([]);
  const [isPrevRunningMode, setIsPrevRunningMode] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
  const bgTimerRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useRef)(null);
  const isCheckingBgRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useRef)(false);
  const localizedData = typeof window !== 'undefined' && window.TranslateSenseBulkData || {};
  const allLanguages = Object.values(localizedData.languages || {});
  const translationState = (0,_hooks_useBulkTranslation__WEBPACK_IMPORTED_MODULE_3__.useBulkTranslation)(selectedPostIds, {
    isPreviouslyRunning: isPrevRunningMode
  });

  // Query selected posts from DOM checkboxes
  const getCheckedPostIds = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
    const checkedBoxes = document.querySelectorAll('input[name="post[]"]:checked, input[name="media[]"]:checked');
    const ids = [];
    checkedBoxes.forEach(cb => {
      const val = parseInt(cb.value, 10);
      if (!isNaN(val) && val > 0) ids.push(val);
    });
    return ids;
  }, []);

  // Update animated pulse dot on Bulk Translate buttons in table header/footer
  const updatePulseDot = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useCallback)(active => {
    const buttons = document.querySelectorAll('.ts-filter-action-btn');
    buttons.forEach(btn => {
      const dot = btn.querySelector('.ts-active-pulse-dot');
      if (dot) {
        dot.style.display = active ? 'inline-flex' : 'none';
      }
      btn.classList.toggle('ts-has-active-jobs', Boolean(active));
    });
  }, []);

  // Stop background polling timer cleanly
  const stopBgPolling = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
    if (bgTimerRef.current) {
      clearTimeout(bgTimerRef.current);
      bgTimerRef.current = null;
    }
    isCheckingBgRef.current = false;
  }, []);

  // Check background jobs with conditional interval scheduling
  const checkBackgroundJobs = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async (shouldSchedule = false) => {
    if (isCheckingBgRef.current) return [];
    isCheckingBgRef.current = true;
    try {
      const res = await (0,_services_batchService__WEBPACK_IMPORTED_MODULE_4__.getActiveBatches)();
      const batches = res.batches || [];
      const active = batches.length > 0;
      setHasActiveJobs(active);
      updatePulseDot(active);

      // Clean up previous timer
      if (bgTimerRef.current) {
        clearTimeout(bgTimerRef.current);
        bgTimerRef.current = null;
      }

      // If active batches exist and scheduled polling is requested, poll again in 10s
      // If NO active batches exist, stop polling immediately (do not schedule another request)
      if (active && shouldSchedule) {
        bgTimerRef.current = setTimeout(() => checkBackgroundJobs(true), 10000);
      }
      return batches;
    } catch {
      setHasActiveJobs(false);
      updatePulseDot(false);
      return [];
    } finally {
      isCheckingBgRef.current = false;
    }
  }, [updatePulseDot]);

  // Initial check on mount: perform one fresh check.
  // Continues polling only while active batches exist; stops immediately if empty.
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    checkBackgroundJobs(true);
    return () => stopBgPolling();
  }, [checkBackgroundJobs, stopBgPolling]);

  // Bind click listener to table action buttons
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    const handleClick = async e => {
      const btn = e.target.closest('.ts-filter-action-btn');
      if (!btn) return;
      e.preventDefault();
      const ids = getCheckedPostIds();

      // Case B1: User has NOT selected any posts
      if (ids.length === 0) {
        let latestBatches = [];
        try {
          const res = await (0,_services_batchService__WEBPACK_IMPORTED_MODULE_4__.getActiveBatches)();
          latestBatches = res.batches || [];
        } catch {
          latestBatches = [];
        }
        const active = latestBatches.length > 0;
        setHasActiveJobs(active);
        updatePulseDot(active);
        if (active) {
          setIsPrevRunningMode(true);
          setSelectedPostIds([]);
          const activeBatch = latestBatches[0];
          translationState.openBatchMonitor(activeBatch.batch_id, activeBatch, latestBatches, {
            sessionType: 'existing_queue',
            modalSource: 'bulk_button'
          });
          setIsOpen(true);
          return;
        }
        alert('Please select posts first.');
        return;
      }

      // Case B2 / Workflow A: User HAS selected posts
      setIsPrevRunningMode(false);
      setSelectedPostIds(ids);
      translationState.setPostIds(ids);
      translationState.setProgressSessionType('new_queue');
      translationState.setProgressModalSource('provider_selection');
      translationState.setCurrentStep(1);

      // Default all languages selected excluding default language on modal open
      const defaultTargets = allLanguages.filter(l => l && l.slug && l.slug !== localizedData.defaultLanguage && !l.is_default).map(l => l.slug);
      translationState.setSelectedLanguages(defaultTargets);

      // Perform one fresh check to see if background jobs are running, so Step 1 notice banner can show
      checkBackgroundJobs(false).then(batches => {
        if (translationState.setActiveBatches) {
          translationState.setActiveBatches(batches || []);
        }
      });
      setIsOpen(true);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [getCheckedPostIds, checkBackgroundJobs, updatePulseDot, translationState]);
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_BulkWizard__WEBPACK_IMPORTED_MODULE_2__.BulkWizard, {
    isOpen: isOpen,
    onClose: () => {
      setIsOpen(false);
      setIsPrevRunningMode(false);
      if (translationState.stopPolling) {
        translationState.stopPolling();
      }
      // When modal is closed: perform one fresh check.
      // If active batches exist, resumes polling; if none, does not start polling.
      checkBackgroundJobs(true);
    },
    translationState: translationState,
    allLanguages: allLanguages
  });
}

/***/ },

/***/ "./src/bulk/components/BulkProgress.jsx"
/*!**********************************************!*\
  !*** ./src/bulk/components/BulkProgress.jsx ***!
  \**********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   BulkProgress: () => (/* binding */ BulkProgress)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _components_ProgressBar__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../components/ProgressBar */ "./src/components/ProgressBar/index.js");

/**
 * BulkProgress Component (Step 3 Progress Bar Card)
 */


function BulkProgress({
  statusText = 'Translating content...',
  percent = 0,
  completedPosts = 0,
  totalPosts = 0,
  timerText = '00:00 elapsed',
  isChromeAi = false,
  activeBatches = [],
  currentBatchId = null,
  onBatchChange,
  isTranslating
}) {
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-bulk-progress-section"
  }, activeBatches && activeBatches.length > 1 && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-batch-switcher-container"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("label", {
    htmlFor: "ts-batch-select",
    className: "ts-batch-select-label"
  }, "Background Batch:"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("select", {
    id: "ts-batch-select",
    className: "ts-batch-select",
    value: currentBatchId || '',
    onChange: e => onBatchChange && onBatchChange(e.target.value)
  }, activeBatches.map(b => {
    const done = (b.completed_jobs || 0) + (b.already_exists_jobs || 0) + (b.skipped_jobs || 0);
    return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("option", {
      key: b.batch_id,
      value: b.batch_id
    }, "Batch ", b.batch_id.substring(0, 8), "... (", done, "/", b.total_jobs, " done, ", b.overall_status, ")");
  }))), isTranslating && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-modal-notice-banner"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-notice-icon",
    "aria-hidden": "true"
  }, isChromeAi ? '⚠️' : '⚡'), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-notice-text"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("strong", {
    className: "ts-notice-title"
  }, isChromeAi ? 'Keep Window Open ' : 'Server-Side Translation Active '), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-notice-desc"
  }, isChromeAi ? 'On-device AI is translating in your browser. Navigating away will cancel remaining jobs.' : 'Your translations are processing in the background on the server. You can safely close this window or navigate away at any time.'))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-progress-card"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-progress-header"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-progress-status"
  }, statusText), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-progress-meta"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-progress-posts-count"
  }, completedPosts, " / ", totalPosts, " posts (", Math.round(percent), "%)"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-progress-timer"
  }, timerText))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-progress-bar-bg"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-progress-bar-fill",
    style: {
      width: `${Math.min(100, Math.max(0, Math.round(percent)))}%`
    }
  }))));
}

/***/ },

/***/ "./src/bulk/components/BulkProgressModal.jsx"
/*!***************************************************!*\
  !*** ./src/bulk/components/BulkProgressModal.jsx ***!
  \***************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   BulkProgressModal: () => (/* binding */ BulkProgressModal)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _components_Modal__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../components/Modal */ "./src/components/Modal/index.js");
/* harmony import */ var _components_Button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../components/Button */ "./src/components/Button/index.js");
/* harmony import */ var _BulkProgress__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./BulkProgress */ "./src/bulk/components/BulkProgress.jsx");
/* harmony import */ var _ProgressSummary__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./ProgressSummary */ "./src/bulk/components/ProgressSummary.jsx");
/* harmony import */ var _TranslationResults__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./TranslationResults */ "./src/bulk/components/TranslationResults.jsx");

/**
 * BulkProgressModal Component (Bulk Step 3 Modal)
 * Encapsulates Progress Monitoring, Results Table, and Actions in its own Modal
 */






function BulkProgressModal({
  isOpen = true,
  onClose,
  isTranslating = false,
  isCompleted = false,
  statusText = '',
  progressPercent = 0,
  completedJobsCount = 0,
  totalJobsCount = 0,
  formattedTimer = '',
  humanReadableTimer = '',
  statsSummary = null,
  selectedProvider = '',
  isChromeAi: explicitIsChromeAi = null,
  activeBatches = [],
  currentBatchId = null,
  onBatchChange,
  orderedPostIds = [],
  postResultsMap = {},
  allLanguages = [],
  filterOnlyFailed = false,
  onFilterChange,
  onSkipPost,
  onErrorDetail,
  showBackButton = false,
  onBack,
  canSkip = false
}) {
  const isChromeAi = explicitIsChromeAi !== null ? Boolean(explicitIsChromeAi) : selectedProvider === 'chrome_ai';
  const hasFailedPosts = Object.values(postResultsMap).some(p => Object.values(p.translations || {}).some(t => t.status === 'failed'));
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Modal__WEBPACK_IMPORTED_MODULE_1__.Modal, {
    isOpen: isOpen,
    onClose: onClose,
    size: "lg",
    className: "ts-bulk-wizard-modal ts-is-progress-step",
    dataStep: 3,
    header: (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Modal__WEBPACK_IMPORTED_MODULE_1__.ModalHeader, {
      title: "Bulk Translation",
      subtitle: "Monitor translation progress",
      onClose: onClose,
      closeClass: "ts-bulk-close"
    }),
    footer: (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Modal__WEBPACK_IMPORTED_MODULE_1__.ModalFooter, {
      align: "space-between"
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }
    }, showBackButton && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Button__WEBPACK_IMPORTED_MODULE_2__.Button, {
      variant: "secondary",
      onClick: onBack,
      id: "ts-progress-back-btn",
      className: "ts-bulk-progress-back-btn"
    }, "\u2190 Back"), hasFailedPosts && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("label", {
      className: "ts-footer-filter-label"
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("input", {
      type: "checkbox",
      checked: filterOnlyFailed,
      onChange: e => onFilterChange && onFilterChange(e.target.checked)
    }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", null, "Only show untranslated or failed items"))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
      className: "ts-footer-buttons-group"
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Button__WEBPACK_IMPORTED_MODULE_2__.Button, {
      variant: "primary",
      disabled: isTranslating && isChromeAi,
      onClick: () => {
        onClose();
        if (isCompleted) {
          window.location.reload();
        }
      }
    }, isTranslating && isChromeAi ? 'Translation In Progress...' : isCompleted ? 'Done (Reload)' : 'Close')))
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-bulk-progress-view"
  }, !isCompleted ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_BulkProgress__WEBPACK_IMPORTED_MODULE_3__.BulkProgress, {
    statusText: statusText,
    percent: progressPercent,
    completedPosts: completedJobsCount,
    totalPosts: totalJobsCount,
    timerText: formattedTimer,
    isChromeAi: isChromeAi,
    activeBatches: activeBatches,
    currentBatchId: currentBatchId,
    onBatchChange: onBatchChange,
    isTranslating: isTranslating
  }) : statsSummary && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_ProgressSummary__WEBPACK_IMPORTED_MODULE_4__.ProgressSummary, {
    completedCount: statsSummary.completed + statsSummary.alreadyExists,
    failedCount: statsSummary.failed,
    totalCharacters: statsSummary.completedCharacters,
    totalCount: statsSummary.total,
    elapsedTime: humanReadableTimer
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_TranslationResults__WEBPACK_IMPORTED_MODULE_5__.TranslationResults, {
    orderedPostIds: orderedPostIds,
    postResultsMap: postResultsMap,
    allLanguages: allLanguages,
    isBackgroundMode: !isChromeAi,
    canSkip: canSkip,
    activeBatchId: currentBatchId,
    filterOnlyFailed: filterOnlyFailed,
    onSkipPost: onSkipPost,
    onErrorDetail: onErrorDetail
  })));
}

/***/ },

/***/ "./src/bulk/components/BulkWizard.jsx"
/*!********************************************!*\
  !*** ./src/bulk/components/BulkWizard.jsx ***!
  \********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   BulkWizard: () => (/* binding */ BulkWizard)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _LanguageSelection__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./LanguageSelection */ "./src/bulk/components/LanguageSelection.jsx");
/* harmony import */ var _ProviderSelection__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./ProviderSelection */ "./src/bulk/components/ProviderSelection.jsx");
/* harmony import */ var _BulkProgressModal__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./BulkProgressModal */ "./src/bulk/components/BulkProgressModal.jsx");
/* harmony import */ var _SkipConfirmation__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./SkipConfirmation */ "./src/bulk/components/SkipConfirmation.jsx");
/* harmony import */ var _components_ErrorModal__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../../components/ErrorModal */ "./src/components/ErrorModal/index.js");

/**
 * BulkWizard Component
 */







function BulkWizard({
  isOpen,
  onClose,
  translationState,
  allLanguages = []
}) {
  const {
    currentStep,
    setCurrentStep,
    postIds,
    selectedLanguages,
    setSelectedLanguages,
    selectedProvider,
    setSelectedProvider,
    providers,
    activeBatches,
    currentBatchId,
    setCurrentBatchId,
    postResultsMap,
    orderedPostIds,
    isTranslating,
    isCompleted,
    progressPercent,
    statusText,
    completedJobsCount,
    totalJobsCount,
    formattedTimer,
    humanReadableTimer,
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
    switchBatch,
    openBatchMonitor,
    progressSessionType,
    progressModalSource,
    isQueueChromeAi
  } = translationState;
  const showBackButton = progressSessionType === 'existing_queue' && progressModalSource === 'language_selection_view_progress';
  const canSkip = progressSessionType === 'existing_queue';
  const handleBackFromProgress = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
    setCurrentStep(1);
  }, [setCurrentStep]);
  if (!isOpen) return null;
  const handleOverlayClick = e => {
    if (e.target !== e.currentTarget) return;
    if (skipModal?.isOpen) {
      setSkipModal({
        isOpen: false,
        postId: null,
        batchId: null
      });
      return;
    }
    if (errorModal?.isOpen) {
      setErrorModal({
        isOpen: false,
        title: '',
        message: '',
        errorObj: null,
        reasonHTML: ''
      });
      return;
    }
    if (currentStep === 3 && isTranslating && isQueueChromeAi) {
      return; // Do not close while on-device translation is actively processing
    }
    if (onClose) {
      onClose();
    }
  };
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-modal-overlay",
    onClick: handleOverlayClick,
    role: "presentation"
  }, skipModal?.isOpen ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_SkipConfirmation__WEBPACK_IMPORTED_MODULE_5__.SkipConfirmation, {
    isOpen: true,
    postId: skipModal.postId,
    onClose: () => setSkipModal({
      isOpen: false,
      postId: null,
      batchId: null
    }),
    onConfirm: () => handleSkipPost(skipModal.postId, skipModal.batchId)
  }) : errorModal?.isOpen ? /* 2. Error Details Modal */
  (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_ErrorModal__WEBPACK_IMPORTED_MODULE_6__.ErrorModal, {
    isOpen: true,
    title: errorModal.title,
    message: errorModal.message,
    reasonHTML: errorModal.reasonHTML,
    icon: errorModal.icon,
    onClose: () => setErrorModal({
      isOpen: false,
      title: '',
      message: '',
      errorObj: null,
      reasonHTML: ''
    })
  }) : currentStep === 1 ? /* 3. Step 1: Language Selection Modal */
  (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_LanguageSelection__WEBPACK_IMPORTED_MODULE_2__.LanguageSelection, {
    isOpen: true,
    onClose: onClose,
    postIds: postIds,
    allLanguages: allLanguages,
    selectedLanguages: selectedLanguages,
    onLanguagesChange: setSelectedLanguages,
    onNext: () => setCurrentStep(2),
    activeBatches: activeBatches,
    onShowRunning: () => {
      const activeBatch = activeBatches && activeBatches[0] ? activeBatches[0] : null;
      if (openBatchMonitor) {
        openBatchMonitor(activeBatch ? activeBatch.batch_id : null, activeBatch, activeBatches, {
          sessionType: 'existing_queue',
          modalSource: 'language_selection_view_progress'
        });
      }
    }
  }) : currentStep === 2 ? /* 4. Step 2: Provider Selection Modal */
  (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_ProviderSelection__WEBPACK_IMPORTED_MODULE_3__.ProviderSelection, {
    isOpen: true,
    onClose: onClose,
    postIds: postIds,
    allLanguages: allLanguages,
    selectedLanguages: selectedLanguages,
    providers: providers,
    selectedProvider: selectedProvider,
    onSelectProvider: setSelectedProvider,
    onBack: () => setCurrentStep(1),
    onStartTranslation: startTranslation,
    onViewError: p => setErrorModal({
      isOpen: true,
      title: `${p.title} Notice`,
      message: p.desc,
      reasonHTML: p.isSupported?.reasonHTML || p.isSupported?.reason,
      icon: p.logo
    })
  }) : currentStep === 3 ? /* 5. Step 3: Progress & Results Modal */
  (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_BulkProgressModal__WEBPACK_IMPORTED_MODULE_4__.BulkProgressModal, {
    isOpen: true,
    onClose: onClose,
    isTranslating: isTranslating,
    isCompleted: isCompleted,
    statusText: statusText,
    progressPercent: progressPercent,
    completedJobsCount: completedJobsCount,
    totalJobsCount: totalJobsCount,
    formattedTimer: formattedTimer,
    humanReadableTimer: humanReadableTimer,
    statsSummary: statsSummary,
    selectedProvider: selectedProvider,
    isChromeAi: isQueueChromeAi,
    activeBatches: activeBatches,
    currentBatchId: currentBatchId,
    onBatchChange: id => {
      if (switchBatch) {
        switchBatch(id);
      } else {
        setCurrentBatchId(id);
        pollStatus(id);
      }
    },
    orderedPostIds: orderedPostIds,
    postResultsMap: postResultsMap,
    allLanguages: allLanguages,
    filterOnlyFailed: filterOnlyFailed,
    onFilterChange: setFilterOnlyFailed,
    onSkipPost: (pId, bId) => setSkipModal({
      isOpen: true,
      postId: pId,
      batchId: bId
    }),
    onErrorDetail: detail => setErrorModal({
      isOpen: true,
      title: detail.title,
      message: detail.message,
      errorObj: detail.errorObj,
      reasonHTML: detail.errorObj?.reasonHTML
    }),
    showBackButton: showBackButton,
    onBack: handleBackFromProgress,
    canSkip: canSkip
  }) : null);
}

/***/ },

/***/ "./src/bulk/components/LanguageSelection.jsx"
/*!***************************************************!*\
  !*** ./src/bulk/components/LanguageSelection.jsx ***!
  \***************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   LanguageSelection: () => (/* binding */ LanguageSelection)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _components_Modal__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../components/Modal */ "./src/components/Modal/index.js");
/* harmony import */ var _components_Button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../components/Button */ "./src/components/Button/index.js");
/* harmony import */ var _components_LanguageSelector__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../components/LanguageSelector */ "./src/components/LanguageSelector/index.js");
/* harmony import */ var _WizardSteps__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./WizardSteps */ "./src/bulk/components/WizardSteps.jsx");

/**
 * LanguageSelection Component (Bulk Step 1 Modal)
 */





function LanguageSelection({
  isOpen = true,
  onClose,
  postIds = [],
  allLanguages = [],
  selectedLanguages = [],
  onLanguagesChange,
  onNext,
  activeBatches = [],
  onShowRunning
}) {
  const postsCount = postIds.length;
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Modal__WEBPACK_IMPORTED_MODULE_1__.Modal, {
    isOpen: isOpen,
    onClose: onClose,
    className: "ts-bulk-wizard-modal",
    dataStep: 1,
    header: (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Modal__WEBPACK_IMPORTED_MODULE_1__.ModalHeader, {
      title: "Bulk Translation",
      subtitle: "Fast & Accurate Multi-Language Content Localizer",
      onClose: onClose,
      closeClass: "ts-bulk-close"
    }),
    footer: (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Modal__WEBPACK_IMPORTED_MODULE_1__.ModalFooter, {
      align: "right"
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Button__WEBPACK_IMPORTED_MODULE_2__.Button, {
      variant: "primary",
      disabled: selectedLanguages.length === 0,
      onClick: onNext
    }, "Next: Choose Provider \u2192"))
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-bulk-step-content",
    id: "ts-view-step-1"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_WizardSteps__WEBPACK_IMPORTED_MODULE_4__.WizardSteps, {
    currentStep: 1,
    selectedLanguagesCount: selectedLanguages.length
  }), activeBatches && activeBatches.length > 0 && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-previous-active-notice",
    id: "ts-previous-active-notice"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-notice-inner"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-notice-icon",
    "aria-hidden": "true"
  }, "\u26A1"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-notice-text"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("strong", {
    className: "ts-notice-title"
  }, "Background translations are running"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-notice-desc"
  }, activeBatches.length === 1 ? 'There is 1 active translation batch in progress.' : `There are ${activeBatches.length} active translation batches in progress.`))), onShowRunning && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "button button-secondary ts-show-running-btn",
    onClick: onShowRunning
  }, "View Progress")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-lang-info-banner"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-info-icon",
    "aria-hidden": "true"
  }, "\u2139\uFE0F"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", null, "Targeting ", (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("strong", {
    className: "ts-highlight-tag"
  }, postsCount, " ", postsCount === 1 ? 'post' : 'posts'), ". Choose target language(s) to translate into:")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_LanguageSelector__WEBPACK_IMPORTED_MODULE_3__.LanguageSelector, {
    languages: allLanguages,
    selectedLanguages: selectedLanguages,
    onChange: onLanguagesChange
  })));
}

/***/ },

/***/ "./src/bulk/components/PostResultItem.jsx"
/*!************************************************!*\
  !*** ./src/bulk/components/PostResultItem.jsx ***!
  \************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   PostResultItem: () => (/* binding */ PostResultItem)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _utils_language__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../utils/language */ "./src/utils/language.js");
/* harmony import */ var _utils_bulkFormatters__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../utils/bulkFormatters */ "./src/bulk/utils/bulkFormatters.js");

/**
 * PostResultItem Component
 * Single post group card with accordion translation rows
 */




function PostResultItem({
  postId,
  postData,
  allLanguages = [],
  isBackgroundMode = false,
  canSkip = false,
  activeBatchId = null,
  onSkipPost,
  onErrorDetail
}) {
  const [expanded, setExpanded] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)(true);
  const {
    postTitle = `Post #${postId}`,
    translations = {},
    provider = ''
  } = postData;
  const transKeys = Object.keys(translations);
  let compCount = 0;
  let failCount = 0;
  let runCount = 0;
  let pendCount = 0;
  let skipCount = 0;
  transKeys.forEach(langSlug => {
    const t = translations[langSlug];
    if (t.status === 'completed' || t.status === 'already_exists') {
      compCount++;
    } else if (t.status === 'failed') {
      failCount++;
    } else if (t.status === 'skipped') {
      skipCount++;
    } else if (t.status === 'running' || t.status === 'processing' || t.status === 'cancelling') {
      runCount++;
    } else {
      pendCount++;
    }
  });

  // Skip button strictly visible in background monitor mode for OpenAI/Gemini with pending/running items
  // AND only when progress session context allows skip (existing_queue sessions)
  const isEligibleProvider = provider === 'openai' || provider === 'gemini';
  const hasActiveJobs = runCount > 0 || pendCount > 0;
  const showSkipBtn = Boolean(canSkip) && isBackgroundMode && isEligibleProvider && hasActiveJobs;
  const handleSkipClick = e => {
    e.stopPropagation();
    if (onSkipPost) {
      onSkipPost(postId, activeBatchId);
    }
  };
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: `ts-post-group-card ${expanded ? 'expanded extended' : ''}`
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-post-group-header",
    onClick: () => setExpanded(prev => !prev)
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-post-source-info"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-post-icon-box"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "dashicons dashicons-media-text"
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-source-title-text"
  }, postTitle), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-post-id-tag"
  }, "#", postId)), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-post-header-right"
  }, showSkipBtn && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-post-skip-btn button button-small",
    onClick: handleSkipClick,
    title: "Skip remaining translations for this post"
  }, "Skip Translations"), failCount > 0 && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-post-status-pill failed"
  }, "Failed (", failCount, ")"), skipCount > 0 && skipCount + compCount === transKeys.length && compCount === 0 && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-post-status-pill skipped"
  }, "Skipped"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: `ts-post-chevron dashicons ${expanded ? 'dashicons-arrow-up-alt2' : 'dashicons-arrow-down-alt2'}`
  }))), expanded && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-post-translations-list ts-translations-accordion-body"
  }, transKeys.map(langSlug => {
    const trans = translations[langSlug];
    const flagInfo = (0,_utils_language__WEBPACK_IMPORTED_MODULE_2__.getLanguageFlag)(langSlug, allLanguages);
    const displayTitle = (0,_utils_bulkFormatters__WEBPACK_IMPORTED_MODULE_3__.getDisplayTitle)(trans, postTitle, postId);
    const isDone = trans.status === 'completed' || trans.status === 'already_exists';
    const isFail = trans.status === 'failed';
    const isSkipped = trans.status === 'skipped';
    const isCancelling = trans.status === 'cancelling';
    const isRunning = trans.status === 'running' || trans.status === 'processing';
    const editUrl = trans.editUrl || (trans.targetPostId ? trans.editorType === 'elementor' ? `post.php?post=${trans.targetPostId}&action=elementor` : `post.php?post=${trans.targetPostId}&action=edit` : '#');
    const viewUrl = trans.viewUrl || (trans.targetPostId ? `/?p=${trans.targetPostId}` : '#');
    const isUnsupported = trans.error && trans.error.toLowerCase().includes('not supported');
    const failText = isUnsupported ? 'Language not supported' : 'Failed';
    return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
      key: langSlug,
      className: `ts-translation-item ${trans.status}`
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
      className: "ts-trans-lang-col"
    }, flagInfo.hasFlag ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("img", {
      src: flagInfo.flagUrl,
      alt: "",
      className: "ts-lang-flag-img"
    }) : null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: "ts-trans-lang-code"
    }, flagInfo.code)), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
      className: "ts-trans-title-col"
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: "ts-trans-title-text",
      title: displayTitle
    }, displayTitle)), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
      className: "ts-trans-status-col"
    }, trans.status === 'already_exists' ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: "ts-row-status completed already-exists"
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: "dashicons dashicons-yes-alt"
    }), " Already exists") : trans.status === 'completed' ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: "ts-row-status completed"
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: "dashicons dashicons-yes-alt"
    }), " Completed") : isSkipped ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: "ts-row-status skipped"
    }, "Skipped") : isCancelling ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: "ts-row-status cancelling"
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: "ts-spinner-circle"
    }), " Cancelling...") : isFail ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
      type: "button",
      className: "ts-row-status failed ts-error-detail-btn",
      onClick: () => onErrorDetail && onErrorDetail({
        title: `${flagInfo.name} (${flagInfo.code}) Error`,
        message: trans.error || 'Translation failed.',
        errorObj: trans.errorObj
      }),
      title: "Click to view error details"
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: "dashicons dashicons-dismiss"
    }), " ", failText) : isRunning ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: "ts-row-status translating"
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: "ts-spinner-circle"
    }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: "ts-translating-label"
    }, "Translating"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: "ts-ellipsis-dots"
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: "ts-dot"
    }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: "ts-dot"
    }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: "ts-dot"
    }))) : (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: "ts-row-status pending"
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: "dashicons dashicons-clock"
    }), " Pending...")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
      className: "ts-trans-actions-col"
    }, isDone ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("a", {
      href: viewUrl,
      target: "_blank",
      rel: "noopener noreferrer",
      className: "ts-row-action-btn view",
      title: "View translated post on site"
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: "dashicons dashicons-visibility"
    }), " View"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("a", {
      href: editUrl,
      target: "_blank",
      rel: "noopener noreferrer",
      className: "ts-row-action-btn edit",
      title: "Edit translated post"
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: "dashicons dashicons-edit"
    }), " Edit")) : !isFail && !isSkipped ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: "ts-row-action-btn view disabled"
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: "dashicons dashicons-visibility"
    }), " View"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: "ts-row-action-btn edit disabled"
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: "dashicons dashicons-edit"
    }), " Edit")) : null));
  })));
}

/***/ },

/***/ "./src/bulk/components/ProgressSummary.jsx"
/*!*************************************************!*\
  !*** ./src/bulk/components/ProgressSummary.jsx ***!
  \*************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ProgressSummary: () => (/* binding */ ProgressSummary)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _utils_formatting__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../utils/formatting */ "./src/utils/formatting.js");

/**
 * ProgressSummary Component
 * 4 metric summary cards displayed upon batch completion
 */


function ProgressSummary({
  completedCount = 0,
  failedCount = 0,
  totalCharacters = 0,
  totalCount = 0,
  elapsedTime = '0s'
}) {
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-summary-stats-grid"
  }, completedCount > 0 && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-stat-card green"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-stat-icon-box green"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "dashicons dashicons-yes-alt"
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-stat-info"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-stat-label"
  }, "Completed Posts"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-stat-val"
  }, completedCount, " / ", totalCount))), failedCount > 0 && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-stat-card red"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-stat-icon-box red"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "dashicons dashicons-dismiss"
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-stat-info"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-stat-label"
  }, "Failed Posts"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-stat-val"
  }, failedCount, " / ", totalCount))), totalCharacters > 0 && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-stat-card blue"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-stat-icon-box blue"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "dashicons dashicons-editor-textcolor"
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-stat-info"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-stat-label"
  }, "Total Characters"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-stat-val",
    title: `${totalCharacters.toLocaleString()} characters`
  }, (0,_utils_formatting__WEBPACK_IMPORTED_MODULE_1__.formatNumber)(totalCharacters)))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-stat-card orange"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-stat-icon-box orange"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "dashicons dashicons-clock"
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-stat-info"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-stat-label"
  }, "Elapsed Time"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-stat-val"
  }, elapsedTime))));
}

/***/ },

/***/ "./src/bulk/components/ProviderSelection.jsx"
/*!***************************************************!*\
  !*** ./src/bulk/components/ProviderSelection.jsx ***!
  \***************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ProviderSelection: () => (/* binding */ ProviderSelection)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _components_Modal__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../components/Modal */ "./src/components/Modal/index.js");
/* harmony import */ var _components_Button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../components/Button */ "./src/components/Button/index.js");
/* harmony import */ var _components_ProviderCard__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../components/ProviderCard */ "./src/components/ProviderCard/index.js");
/* harmony import */ var _WizardSteps__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./WizardSteps */ "./src/bulk/components/WizardSteps.jsx");
/* harmony import */ var _utils_language__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../../utils/language */ "./src/utils/language.js");

/**
 * ProviderSelection Component (Bulk Step 2 Modal)
 */






function ProviderSelection({
  isOpen = true,
  onClose,
  postIds = [],
  allLanguages = [],
  selectedLanguages = [],
  providers = [],
  selectedProvider = '',
  onSelectProvider,
  onBack,
  onStartTranslation,
  onViewError
}) {
  const postsCount = postIds.length;
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Modal__WEBPACK_IMPORTED_MODULE_1__.Modal, {
    isOpen: isOpen,
    onClose: onClose,
    className: "ts-bulk-wizard-modal",
    dataStep: 2,
    header: (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Modal__WEBPACK_IMPORTED_MODULE_1__.ModalHeader, {
      title: "Bulk Translation",
      subtitle: "Choose a translation provider",
      onClose: onClose,
      closeClass: "ts-bulk-close"
    }),
    footer: (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Modal__WEBPACK_IMPORTED_MODULE_1__.ModalFooter, {
      align: "right"
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
      style: {
        display: 'flex',
        gap: '10px'
      }
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Button__WEBPACK_IMPORTED_MODULE_2__.Button, {
      variant: "secondary",
      onClick: onBack
    }, "\u2190 Back"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Button__WEBPACK_IMPORTED_MODULE_2__.Button, {
      variant: "primary",
      onClick: onStartTranslation,
      disabled: !selectedProvider
    }, "Start Bulk Translation")))
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-bulk-step-content",
    id: "ts-view-step-2"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_WizardSteps__WEBPACK_IMPORTED_MODULE_4__.WizardSteps, {
    currentStep: 2,
    selectedLanguagesCount: selectedLanguages.length
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-summary-box"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-summary-info"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", null, "Targeting ", (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("strong", null, postsCount, " ", postsCount === 1 ? 'post' : 'posts'), " across ", (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("strong", null, selectedLanguages.length, " languages"), ":"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-summary-langs-tags"
  }, selectedLanguages.map(slug => {
    const flagInfo = (0,_utils_language__WEBPACK_IMPORTED_MODULE_5__.getLanguageFlag)(slug, allLanguages);
    return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      key: slug,
      className: "ts-summary-lang-pill"
    }, flagInfo.hasFlag && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("img", {
      src: flagInfo.flagUrl,
      alt: "",
      className: "ts-pill-flag"
    }), ` (${flagInfo.code})`);
  })))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-bulk-field"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-provider-list",
    id: "ts-bulk-provider-list"
  }, providers.map(p => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_ProviderCard__WEBPACK_IMPORTED_MODULE_3__.ProviderCard, {
    key: p.id,
    provider: p,
    isSelected: selectedProvider === p.id,
    onSelect: onSelectProvider,
    onViewError: onViewError,
    name: "ts_bulk_provider"
  }))))));
}

/***/ },

/***/ "./src/bulk/components/SkipConfirmation.jsx"
/*!**************************************************!*\
  !*** ./src/bulk/components/SkipConfirmation.jsx ***!
  \**************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SkipConfirmation: () => (/* binding */ SkipConfirmation)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _components_ConfirmDialog__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../components/ConfirmDialog */ "./src/components/ConfirmDialog/index.js");

/**
 * SkipConfirmation Component
 */


function SkipConfirmation({
  isOpen,
  postId,
  onClose,
  onConfirm,
  loading = false
}) {
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_ConfirmDialog__WEBPACK_IMPORTED_MODULE_1__.ConfirmDialog, {
    isOpen: isOpen,
    onClose: onClose,
    onConfirm: onConfirm,
    title: "Skip remaining translations?",
    message: "This will skip the remaining pending translations for this post in the selected batch. Completed translations will not be affected.",
    confirmLabel: "Skip Remaining Translations",
    cancelLabel: "Keep Translating",
    isDanger: true,
    loading: loading
  });
}

/***/ },

/***/ "./src/bulk/components/TranslationResults.jsx"
/*!****************************************************!*\
  !*** ./src/bulk/components/TranslationResults.jsx ***!
  \****************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TranslationResults: () => (/* binding */ TranslationResults)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _PostResultItem__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./PostResultItem */ "./src/bulk/components/PostResultItem.jsx");

/**
 * TranslationResults Component
 * Grouped accordion results list container
 */


function TranslationResults({
  orderedPostIds = [],
  postResultsMap = {},
  allLanguages = [],
  isBackgroundMode = false,
  canSkip = false,
  activeBatchId = null,
  filterOnlyFailed = false,
  onSkipPost,
  onErrorDetail
}) {
  const postIdsList = orderedPostIds.length > 0 ? orderedPostIds.filter(pid => Boolean(postResultsMap[pid])) : Object.keys(postResultsMap);
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-results-container",
    id: "ts-results-container"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-results-list",
    id: "ts-results-list"
  }, postIdsList.map(pid => {
    const postData = postResultsMap[pid];
    if (!postData) return null;

    // If filterOnlyFailed is active, check if any translations are non-completed
    if (filterOnlyFailed) {
      const hasUntranslatedOrFailed = Object.values(postData.translations || {}).some(t => t.status !== 'completed' && t.status !== 'already_exists');
      if (!hasUntranslatedOrFailed) {
        return null;
      }
    }
    return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_PostResultItem__WEBPACK_IMPORTED_MODULE_1__.PostResultItem, {
      key: pid,
      postId: pid,
      postData: postData,
      allLanguages: allLanguages,
      isBackgroundMode: isBackgroundMode,
      canSkip: canSkip,
      activeBatchId: activeBatchId,
      onSkipPost: onSkipPost,
      onErrorDetail: onErrorDetail
    });
  })));
}

/***/ },

/***/ "./src/bulk/components/WizardSteps.jsx"
/*!*********************************************!*\
  !*** ./src/bulk/components/WizardSteps.jsx ***!
  \*********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   WizardSteps: () => (/* binding */ WizardSteps)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);

/**
 * WizardSteps Component
 */

function WizardSteps({
  currentStep = 1,
  selectedLanguagesCount = 0
}) {
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-step-bar"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: `ts-step-item ${currentStep === 1 ? 'active' : currentStep > 1 ? 'completed' : ''}`
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-step-number"
  }, currentStep > 1 ? '✓' : '1'), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", null, currentStep > 1 ? `${selectedLanguagesCount} Languages` : 'Select Target Languages')), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-step-divider"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: `ts-step-item ${currentStep === 2 ? 'active' : currentStep > 2 ? 'completed' : ''}`
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-step-number"
  }, currentStep > 2 ? '✓' : '2'), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", null, "Choose Provider")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-step-divider"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: `ts-step-item ${currentStep === 3 ? 'active' : ''}`
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-step-number"
  }, "3"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", null, "Translation Progress")));
}

/***/ },

/***/ "./src/bulk/hooks/useBulkTranslation.js"
/*!**********************************************!*\
  !*** ./src/bulk/hooks/useBulkTranslation.js ***!
  \**********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   useBulkTranslation: () => (/* binding */ useBulkTranslation)
/* harmony export */ });
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _services_providers_providerService__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../services/providers/providerService */ "./src/services/providers/providerService.js");
/* harmony import */ var _services_bulkService__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../services/bulkService */ "./src/bulk/services/bulkService.js");
/* harmony import */ var _services_batchService__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../services/batchService */ "./src/bulk/services/batchService.js");
/* harmony import */ var _services_core_translationService__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../services/core/translationService */ "./src/services/core/translationService.js");
/* harmony import */ var _services_core_coreService__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../../services/core/coreService */ "./src/services/core/coreService.js");
/* harmony import */ var _utils_validation__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../../utils/validation */ "./src/utils/validation.js");
/* harmony import */ var _utils_bulkCalculations__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../utils/bulkCalculations */ "./src/bulk/utils/bulkCalculations.js");
/* harmony import */ var _useElapsedTimer__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./useElapsedTimer */ "./src/bulk/hooks/useElapsedTimer.js");









function useBulkTranslation(initialPostIds = [], options = {}) {
  const isPreviouslyRunning = Boolean(options.isPreviouslyRunning);
  const targetBatchId = options.batchId || null;
  const [currentStep, setCurrentStep] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(isPreviouslyRunning ? 3 : 1);
  const [postIds, setPostIds] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(initialPostIds);
  const localizedData = typeof window !== 'undefined' && window.TranslateSenseBulkData || {};
  const defaultLanguage = localizedData.defaultLanguage || '';
  const allConfiguredLanguages = Object.values(localizedData.languages || {});
  const getDefaultTargetLanguages = () => {
    return allConfiguredLanguages.filter(l => l && l.slug && l.slug !== defaultLanguage && !l.is_default).map(l => l.slug);
  };
  const [selectedLanguages, setSelectedLanguages] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(() => getDefaultTargetLanguages());
  const [selectedProvider, setSelectedProvider] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)('openai');
  const [providers, setProviders] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
  const [activeBatches, setActiveBatches] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
  const [currentBatchId, setCurrentBatchId] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(targetBatchId);
  const [currentBatch, setCurrentBatch] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
  const currentBatchIdRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useRef)(targetBatchId);
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    currentBatchIdRef.current = currentBatchId;
  }, [currentBatchId]);
  const [postResultsMap, setPostResultsMap] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)({});
  const [orderedPostIds, setOrderedPostIds] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
  const [isTranslating, setIsTranslating] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [isCompleted, setIsCompleted] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [progressPercent, setProgressPercent] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(0);
  const [statusText, setStatusText] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)('Initializing...');
  const [completedJobsCount, setCompletedJobsCount] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(0);
  const [totalJobsCount, setTotalJobsCount] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(0);
  const [statsSummary, setStatsSummary] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
  const [filterOnlyFailed, setFilterOnlyFailed] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(false);

  // Modal progress session context: separates new user queue from existing background queue
  const [progressSessionType, setProgressSessionType] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)('new_queue'); // 'new_queue' | 'existing_queue'
  const [progressModalSource, setProgressModalSource] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)('provider_selection'); // 'provider_selection' | 'bulk_button' | 'language_selection_view_progress'

  // Modals
  const [skipModal, setSkipModal] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)({
    isOpen: false,
    postId: null,
    batchId: null
  });
  const [errorModal, setErrorModal] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)({
    isOpen: false,
    title: '',
    message: '',
    errorObj: null
  });

  // Timer
  const {
    formattedTimer,
    humanReadable,
    startTimer,
    stopTimer,
    resetTimer
  } = (0,_useElapsedTimer__WEBPACK_IMPORTED_MODULE_8__.useElapsedTimer)(isTranslating);
  const pollTimerRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useRef)(null);
  const isPollingRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useRef)(false);

  // Chrome AI detection: active queue data is source of truth for existing queue
  const isQueueChromeAi = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useMemo)(() => {
    if (progressSessionType === 'new_queue') {
      return selectedProvider === 'chrome_ai';
    }
    const activeBatch = currentBatch || activeBatches && activeBatches.find(b => b.batch_id === currentBatchId);
    if (activeBatch) {
      if (activeBatch.provider === 'chrome_ai' || activeBatch.provider === 'chrome_local_ai') {
        return true;
      }
      if (Array.isArray(activeBatch.items)) {
        const hasActiveChrome = activeBatch.items.some(item => {
          const isChrome = item.provider === 'chrome_ai' || item.provider === 'chrome_local_ai';
          const isActive = item.status === 'pending' || item.status === 'running' || item.status === 'processing';
          return isChrome && isActive;
        });
        if (hasActiveChrome) return true;
      }
    }
    for (const post of Object.values(postResultsMap || {})) {
      if (post.provider === 'chrome_ai' || post.provider === 'chrome_local_ai') {
        const hasActiveTrans = Object.values(post.translations || {}).some(t => t.status === 'pending' || t.status === 'running' || t.status === 'processing');
        if (hasActiveTrans) return true;
      }
      for (const t of Object.values(post.translations || {})) {
        const isChrome = t.provider === 'chrome_ai' || t.provider === 'chrome_local_ai';
        const isActive = t.status === 'pending' || t.status === 'running' || t.status === 'processing';
        if (isChrome && isActive) return true;
      }
    }
    return false;
  }, [progressSessionType, selectedProvider, currentBatch, activeBatches, currentBatchId, postResultsMap]);

  // Load providers and active batches on mount
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    let mounted = true;
    (0,_services_providers_providerService__WEBPACK_IMPORTED_MODULE_1__.getEvaluatedProviders)('en', selectedLanguages[0] || 'es').then(list => {
      if (!mounted) return;
      setProviders(list);
      const firstAvail = list.find(p => p.isAvailable && p.statusMeta.isConnected);
      if (firstAvail) {
        setSelectedProvider(firstAvail.id);
      }
    });
    (0,_services_batchService__WEBPACK_IMPORTED_MODULE_3__.getActiveBatches)().then(res => {
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

  // Stop background polling timer
  const stopPolling = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useCallback)(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    isPollingRef.current = false;
  }, []);

  // Populate map from batch
  const populateMapFromBatch = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useCallback)((batchData, replace = false) => {
    if (!batchData || !Array.isArray(batchData.items)) return;
    setPostResultsMap(prev => {
      const updated = replace ? {} : {
        ...prev
      };
      batchData.items.forEach(item => {
        const pId = String(item.post_id);
        const tLang = String(item.target_language);
        if (!updated[pId]) {
          updated[pId] = {
            postId: item.post_id,
            postTitle: item.post_title || `Post #${item.post_id}`,
            provider: item.provider || batchData.provider || 'openai',
            translations: {}
          };
        }
        if (item.post_title) updated[pId].postTitle = item.post_title;
        updated[pId].translations[tLang] = {
          targetLang: item.target_language,
          targetPostId: item.target_post_id,
          targetTitle: item.target_post_title || (item.status === 'already_exists' || item.status === 'completed' ? item.target_post_title || item.post_title : item.progress_status || 'Processing...'),
          editorType: item.editor_type,
          status: item.status,
          completedStrings: item.completed_strings,
          totalStrings: item.total_strings,
          completedCharacters: item.completed_characters || (item.completed_strings ? item.completed_strings * 45 : 0),
          totalCharacters: item.total_characters || (item.total_strings ? item.total_strings * 45 : 0),
          progressPercent: (0,_utils_bulkCalculations__WEBPACK_IMPORTED_MODULE_7__.getPostProgress)(item),
          progressStatus: item.progress_status || '',
          editUrl: item.edit_url || (item.target_post_id ? `post.php?post=${item.target_post_id}&action=edit` : ''),
          viewUrl: item.view_url || (item.target_post_id ? `/?p=${item.target_post_id}` : ''),
          error: item.error_message,
          provider: item.provider || batchData.provider
        };
      });
      return updated;
    });
    const itemsOrder = [];
    batchData.items.forEach(it => {
      const pidStr = String(it.post_id);
      if (!itemsOrder.includes(pidStr)) itemsOrder.push(pidStr);
    });
    setOrderedPostIds(itemsOrder);
  }, []);

  // Server background polling logic
  const pollStatus = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async batchIdToPoll => {
    const bId = batchIdToPoll || currentBatchIdRef.current;
    if (!bId) return;
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (isPollingRef.current) return;
    isPollingRef.current = true;
    try {
      const data = await (0,_services_batchService__WEBPACK_IMPORTED_MODULE_3__.getBatchStatus)(bId);

      // Discard result if user switched to another batch in the meantime
      if (currentBatchIdRef.current && currentBatchIdRef.current !== bId) {
        return;
      }
      setCurrentBatch(data);
      setCurrentBatchId(bId);
      currentBatchIdRef.current = bId;
      const pct = Array.isArray(data.items) && data.items.length > 0 ? Math.round((0,_utils_bulkCalculations__WEBPACK_IMPORTED_MODULE_7__.getOverallProgress)(data.items)) : Math.round(data.progress_percent || 0);
      setProgressPercent(pct);
      const done = (data.completed_jobs || 0) + (data.already_exists_jobs || 0) + (data.skipped_jobs || 0);
      setCompletedJobsCount(done);
      setTotalJobsCount(data.total_jobs || (data.items ? data.items.length : 1));
      setStatusText(data.current_status || `Translating content in background... (${pct}%)`);
      populateMapFromBatch(data, false);
      const isFinished = data.overall_status === 'completed' || data.overall_status === 'failed' || data.overall_status === 'skipped' || data.overall_status === 'cancelled';
      if (isFinished) {
        setIsTranslating(false);
        setIsCompleted(true);
        stopTimer();
        const stats = (0,_utils_bulkCalculations__WEBPACK_IMPORTED_MODULE_7__.calculateBatchStats)(data.items || []);
        setStatsSummary(stats);

        // Continue polling only while active batches exist; stop immediately if all finished
        try {
          const res = await (0,_services_batchService__WEBPACK_IMPORTED_MODULE_3__.getActiveBatches)();
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
        const res = await (0,_services_batchService__WEBPACK_IMPORTED_MODULE_3__.getActiveBatches)();
        const remaining = res.batches || [];
        setActiveBatches(remaining);
        if (remaining.length > 0 && remaining.some(b => b.batch_id === bId)) {
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
  }, [populateMapFromBatch, startTimer, stopTimer]);

  // Monitor mode activator: immediately enters Step 3 with populated batch data
  const openBatchMonitor = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (targetBatchId = null, initialBatchData = null, allBatches = null, contextOptions = {}) => {
    stopPolling();
    const sessionType = contextOptions.sessionType || 'existing_queue';
    const modalSource = contextOptions.modalSource || 'bulk_button';
    setProgressSessionType(sessionType);
    setProgressModalSource(modalSource);
    setCurrentStep(3);
    let bId = targetBatchId || currentBatchIdRef.current;
    let data = initialBatchData;
    if (allBatches && Array.isArray(allBatches)) {
      setActiveBatches(allBatches);
    }

    // If missing batch ID or data, trigger /bulk-active-batches immediately once
    if (!bId || !data) {
      try {
        const res = await (0,_services_batchService__WEBPACK_IMPORTED_MODULE_3__.getActiveBatches)();
        const batches = res.batches || [];
        setActiveBatches(batches);

        // If the response contains an empty batches array, stop polling immediately.
        // Do not schedule another request when there are no active batches.
        if (batches.length === 0) {
          setIsTranslating(false);
          stopTimer();
          setStatusText('No active translation batches.');
          return;
        }
        bId = bId || batches[0].batch_id;
        data = data || batches.find(b => b.batch_id === bId) || batches[0];
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
        const isFinished = data.overall_status === 'completed' || data.overall_status === 'failed' || data.overall_status === 'skipped' || data.overall_status === 'cancelled';
        if (isFinished) {
          setIsTranslating(false);
          setIsCompleted(true);
          stopTimer();
          const stats = (0,_utils_bulkCalculations__WEBPACK_IMPORTED_MODULE_7__.calculateBatchStats)(data.items || []);
          setStatsSummary(stats);
          // Completed batch: do not schedule polling
          return;
        } else {
          setIsTranslating(true);
          setIsCompleted(false);
          startTimer();
        }
        const pct = Array.isArray(data.items) && data.items.length > 0 ? Math.round((0,_utils_bulkCalculations__WEBPACK_IMPORTED_MODULE_7__.getOverallProgress)(data.items)) : Math.round(data.progress_percent || 0);
        setProgressPercent(pct);
        const done = (data.completed_jobs || 0) + (data.already_exists_jobs || 0) + (data.skipped_jobs || 0);
        setCompletedJobsCount(done);
        setTotalJobsCount(data.total_jobs || (data.items ? data.items.length : 1));
        setStatusText(data.current_status || `Translating content in background... (${pct}%)`);
      } else {
        setIsTranslating(true);
        setIsCompleted(false);
        startTimer();
      }

      // Start live polling cycle
      pollStatus(bId);
    }
  }, [populateMapFromBatch, pollStatus, startTimer, stopTimer, stopPolling]);

  // Switch between multiple background batches preserving session context
  const switchBatch = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useCallback)(newBatchId => {
    if (!newBatchId) return;
    const batchData = activeBatches.find(b => b.batch_id === newBatchId) || null;
    openBatchMonitor(newBatchId, batchData, activeBatches, {
      sessionType: progressSessionType,
      modalSource: progressModalSource
    });
  }, [activeBatches, openBatchMonitor, progressSessionType, progressModalSource]);

  // Auto-open monitor if options.isPreviouslyRunning is true
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    if (isPreviouslyRunning) {
      openBatchMonitor(targetBatchId);
    }
  }, [isPreviouslyRunning, targetBatchId, openBatchMonitor]);

  // Chrome Local AI Execution Workflow
  const runChromeAiTranslation = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (jobsList, batchId) => {
    const core = (0,_services_core_coreService__WEBPACK_IMPORTED_MODULE_5__.getCoreInstance)();
    const totalJobs = jobsList.length || 1;
    let completedCount = 0;
    let failedCount = 0;
    const extractedCache = {};

    // Track live state of each job for accurate, continuous overall progress calculations matching pollStatus
    const runningJobs = jobsList.map(job => {
      const isExists = job.status === 'already_exists';
      if (isExists) {
        completedCount++;
      }
      return {
        id: job.id,
        post_id: job.post_id,
        target_language: job.target_language,
        status: isExists ? 'already_exists' : job.status || 'pending',
        total_strings: Number(job.total_strings) || 0,
        completed_strings: Number(job.completed_strings) || 0
      };
    });

    // Synchronize initial batch jobs info into postResultsMap
    setPostResultsMap(prev => {
      const updated = {
        ...prev
      };
      jobsList.forEach(j => {
        const pId = String(j.post_id);
        const tLang = String(j.target_language);
        if (!updated[pId]) {
          updated[pId] = {
            postId: j.post_id,
            postTitle: j.post_title || `Post #${pId}`,
            provider: j.provider || 'chrome_ai',
            translations: {}
          };
        } else if (j.post_title) {
          updated[pId].postTitle = j.post_title;
        }
        const existingTrans = updated[pId].translations[tLang] || {};
        updated[pId].translations[tLang] = {
          ...existingTrans,
          targetLang: j.target_language,
          targetPostId: j.target_post_id || existingTrans.targetPostId || null,
          targetTitle: j.status === 'already_exists' ? j.target_post_title || j.post_title || existingTrans.targetTitle || '' : existingTrans.targetTitle || '',
          editorType: j.editor_type || existingTrans.editorType,
          status: j.status || existingTrans.status || 'pending',
          completedStrings: j.completed_strings || existingTrans.completedStrings || 0,
          totalStrings: j.total_strings || existingTrans.totalStrings || 0,
          progressPercent: (0,_utils_bulkCalculations__WEBPACK_IMPORTED_MODULE_7__.getPostProgress)(j),
          progressStatus: j.progress_status || existingTrans.progressStatus || '',
          editUrl: j.edit_url || existingTrans.editUrl || '',
          viewUrl: j.view_url || existingTrans.viewUrl || '',
          error: j.error_message || existingTrans.error || '',
          provider: j.provider || 'chrome_ai'
        };
      });
      return updated;
    });
    setCompletedJobsCount(completedCount);
    setTotalJobsCount(totalJobs);
    const initialPct = Math.round((0,_utils_bulkCalculations__WEBPACK_IMPORTED_MODULE_7__.getOverallProgress)(runningJobs));
    setProgressPercent(initialPct);
    setStatusText(initialPct > 0 ? `Starting on-device translation... (${initialPct}%)` : 'Starting on-device translation...');
    for (let i = 0; i < jobsList.length; i++) {
      const job = jobsList[i];
      const postId = String(job.post_id);
      const targetLang = String(job.target_language);
      const jobId = job.id;
      const postTitle = job.post_title || `Post #${postId}`;
      if (job.status === 'already_exists') {
        continue;
      }

      // If queue post is more than 1 day old, mark status as failed and do not translate
      const jobCreated = job.created_at ? new Date(job.created_at).getTime() : 0;
      const isOneDayOld = jobCreated > 0 && Date.now() - jobCreated >= 86400000;
      if (isOneDayOld) {
        failedCount++;
        runningJobs[i].status = 'failed';
        await (0,_services_bulkService__WEBPACK_IMPORTED_MODULE_2__.updateBulkJob)(jobId, {
          status: 'failed',
          progress_status: 'Failed: Job expired (more than 1 day old)',
          error_message: 'Translation job expired: queued for more than 1 day.'
        });
        setPostResultsMap(prev => {
          const updated = {
            ...prev
          };
          if (updated[postId] && updated[postId].translations[targetLang]) {
            const t = {
              ...updated[postId].translations[targetLang]
            };
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
      const startJobPct = Math.round((0,_utils_bulkCalculations__WEBPACK_IMPORTED_MODULE_7__.getOverallProgress)(runningJobs));
      setProgressPercent(startJobPct);
      setPostResultsMap(prev => {
        const updated = {
          ...prev
        };
        if (updated[postId] && updated[postId].translations[targetLang]) {
          const t = {
            ...updated[postId].translations[targetLang]
          };
          t.status = 'running';
          t.progressStatus = `Extracting strings for ${postTitle}...`;
          t.targetTitle = `Extracting strings for ${postTitle}...`;
          t.progressPercent = (0,_utils_bulkCalculations__WEBPACK_IMPORTED_MODULE_7__.getPostProgress)(runningJobs[i]);
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
          const extRes = await (0,_services_core_translationService__WEBPACK_IMPORTED_MODULE_4__.extractStrings)(postId);
          rawStrings = extRes.strings || [];
          extractedCache[postId] = rawStrings;
        }
        const translatable = rawStrings.filter(s => s.value && s.value.trim() && !(0,_utils_validation__WEBPACK_IMPORTED_MODULE_6__.isEmailOrUrl)(s.value));
        if (translatable.length === 0) {
          console.error('No translatable text found in post.');
        }
        const totalStrings = translatable.length;
        const totalCharacters = translatable.reduce((acc, s) => acc + (s.value ? s.value.length : 0), 0);
        let completedStrings = 0;
        let completedCharacters = 0;
        runningJobs[i].total_strings = totalStrings;
        runningJobs[i].completed_strings = 0;
        runningJobs[i].total_characters = totalCharacters;
        runningJobs[i].completed_characters = 0;
        runningJobs[i].status = 'running';
        const extractDonePct = Math.round((0,_utils_bulkCalculations__WEBPACK_IMPORTED_MODULE_7__.getOverallProgress)(runningJobs));
        setProgressPercent(extractDonePct);
        setStatusText(`Translating ${totalStrings} strings on-device for ${postTitle} (${targetLang.toUpperCase()})... (${extractDonePct}%)`);
        setPostResultsMap(prev => {
          const updated = {
            ...prev
          };
          if (updated[postId] && updated[postId].translations[targetLang]) {
            const t = {
              ...updated[postId].translations[targetLang]
            };
            t.status = 'running';
            t.totalStrings = totalStrings;
            t.completedStrings = 0;
            t.totalCharacters = totalCharacters;
            t.completedCharacters = 0;
            t.progressPercent = (0,_utils_bulkCalculations__WEBPACK_IMPORTED_MODULE_7__.getPostProgress)(runningJobs[i]);
            t.progressStatus = `0/${totalStrings} strings translated`;
            t.targetTitle = `Translating 0/${totalStrings} strings...`;
            updated[postId].translations[targetLang] = t;
          }
          return updated;
        });
        const inMemoryTranslations = {};
        const itemsToTranslate = translatable.map(s => ({
          hash: s.hash,
          widget_id: s.name,
          field: s.key,
          content: s.value
        }));
        if (core) {
          await core.translate('chrome_ai', {
            items: itemsToTranslate,
            sourceLang: 'en',
            targetLang,
            postId
          }, resItem => {
            if (resItem && resItem.translated && resItem.hash) {
              inMemoryTranslations[resItem.hash] = resItem.translated;
            }
            completedStrings++;
            const orig = translatable.find(s => s.hash === resItem?.hash);
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
            const postPct = (0,_utils_bulkCalculations__WEBPACK_IMPORTED_MODULE_7__.getPostProgress)(runningJobs[i]);
            const overallPct = Math.round((0,_utils_bulkCalculations__WEBPACK_IMPORTED_MODULE_7__.getOverallProgress)(runningJobs));
            setProgressPercent(overallPct);
            setStatusText(`Translating on-device: ${postTitle} (${targetLang.toUpperCase()}) - string ${completedStrings} of ${totalStrings} (${overallPct}%)`);
            setPostResultsMap(prev => {
              const updated = {
                ...prev
              };
              if (updated[postId] && updated[postId].translations[targetLang]) {
                const t = {
                  ...updated[postId].translations[targetLang]
                };
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
          });
        }
        setStatusText(`Saving ${postTitle} (${targetLang.toUpperCase()}) to WordPress...`);
        setPostResultsMap(prev => {
          const updated = {
            ...prev
          };
          if (updated[postId] && updated[postId].translations[targetLang]) {
            const t = {
              ...updated[postId].translations[targetLang]
            };
            t.progressStatus = 'Saving translated post to WordPress...';
            t.targetTitle = 'Saving translated post to WordPress...';
            updated[postId].translations[targetLang] = t;
          }
          return updated;
        });
        const postRes = await (0,_services_core_translationService__WEBPACK_IMPORTED_MODULE_4__.translatePost)({
          post_id: postId,
          target_lang: targetLang,
          provider: 'chrome_ai',
          in_memory_translations: inMemoryTranslations
        });
        const sentStrings = translatable.map(s => s.value);
        await (0,_services_bulkService__WEBPACK_IMPORTED_MODULE_2__.updateBulkJob)(jobId, {
          status: 'completed',
          progress_status: 'Completed successfully',
          total_strings: rawStrings.length,
          completed_strings: rawStrings.length,
          total_characters: totalCharacters,
          completed_characters: totalCharacters,
          sent_data: sentStrings,
          time_take: Math.round(performance.now() - jobStartTime),
          target_post_id: postRes.target_post_id
        });
        runningJobs[i].status = 'completed';
        runningJobs[i].completed_strings = rawStrings.length;
        runningJobs[i].total_strings = rawStrings.length;
        runningJobs[i].completed_characters = totalCharacters;
        runningJobs[i].total_characters = totalCharacters;
        completedCount++;
        setCompletedJobsCount(completedCount);
        const postFinishPct = Math.round((0,_utils_bulkCalculations__WEBPACK_IMPORTED_MODULE_7__.getOverallProgress)(runningJobs));
        setProgressPercent(postFinishPct);
        setPostResultsMap(prev => {
          const updated = {
            ...prev
          };
          if (updated[postId] && updated[postId].translations[targetLang]) {
            const t = {
              ...updated[postId].translations[targetLang]
            };
            t.status = 'completed';
            t.targetPostId = postRes.target_post_id;
            t.targetTitle = postRes.translated_title || postTitle;
            t.editUrl = postRes.edit_url;
            t.viewUrl = postRes.view_url;
            t.completedStrings = rawStrings.length;
            t.totalStrings = rawStrings.length;
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
        console.error(`[TranslateSense] Chrome AI error for post #${postId}:`, err);
        runningJobs[i].status = 'failed';
        const postFailPct = Math.round((0,_utils_bulkCalculations__WEBPACK_IMPORTED_MODULE_7__.getOverallProgress)(runningJobs));
        setProgressPercent(postFailPct);
        await (0,_services_bulkService__WEBPACK_IMPORTED_MODULE_2__.updateBulkJob)(jobId, {
          status: 'failed',
          progress_status: `Failed: ${err.message}`,
          error_message: err.message,
          total_strings: rawStrings.length || 0,
          time_take: Math.round(performance.now() - jobStartTime)
        });
        setPostResultsMap(prev => {
          const updated = {
            ...prev
          };
          if (updated[postId] && updated[postId].translations[targetLang]) {
            const t = {
              ...updated[postId].translations[targetLang]
            };
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
    setStatusText(failedCount > 0 ? `Completed with ${failedCount} errors.` : 'All translations completed successfully!');
    setIsTranslating(false);
    stopTimer();

    // Calculate final stats
    setPostResultsMap(finalMap => {
      const allItems = [];
      Object.values(finalMap).forEach(p => {
        Object.values(p.translations).forEach(t => allItems.push(t));
      });
      setStatsSummary((0,_utils_bulkCalculations__WEBPACK_IMPORTED_MODULE_7__.calculateBatchStats)(allItems));
      return finalMap;
    });
    await new Promise(resolve => setTimeout(resolve, 3000));
    setIsCompleted(true);
  }, [stopTimer]);

  // Start translation trigger from Step 2
  const startTranslation = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async () => {
    setProgressSessionType('new_queue');
    setProgressModalSource('provider_selection');
    setCurrentStep(3);
    setIsTranslating(true);
    setIsCompleted(false);
    setProgressPercent(0);
    resetTimer();
    const isChromeAi = selectedProvider === 'chrome_ai';

    // Initialize map
    const initialMap = {};
    postIds.forEach(pid => {
      const pidStr = String(pid);
      initialMap[pidStr] = {
        postId: pid,
        postTitle: `Post #${pid}`,
        provider: selectedProvider,
        translations: {}
      };
      selectedLanguages.forEach(lang => {
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
          provider: selectedProvider
        };
      });
    });
    setPostResultsMap(initialMap);
    setOrderedPostIds(postIds.map(String));
    setTotalJobsCount(postIds.length * selectedLanguages.length);
    setCompletedJobsCount(0);
    try {
      const batchRes = await (0,_services_bulkService__WEBPACK_IMPORTED_MODULE_2__.startBulkTranslation)({
        post_ids: postIds,
        target_languages: selectedLanguages,
        provider: selectedProvider
      });
      if (!batchRes.batch_id) {
        console.error(batchRes.message || 'Failed to start batch');
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
        message: err.message
      });
    }
  }, [postIds, selectedLanguages, selectedProvider, resetTimer, runChromeAiTranslation, pollStatus]);

  // Handle Skip Action
  const handleSkipPost = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (postId, batchId) => {
    setSkipModal({
      isOpen: false,
      postId: null,
      batchId: null
    });
    try {
      await (0,_services_bulkService__WEBPACK_IMPORTED_MODULE_2__.skipBulkPost)(batchId || currentBatchId, postId);
      pollStatus(batchId || currentBatchId);
    } catch (err) {
      setErrorModal({
        isOpen: true,
        title: 'Skip Failed',
        message: err.message || 'Could not skip translations.'
      });
    }
  }, [currentBatchId, pollStatus]);
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
    isQueueChromeAi
  };
}

/***/ },

/***/ "./src/bulk/hooks/useElapsedTimer.js"
/*!*******************************************!*\
  !*** ./src/bulk/hooks/useElapsedTimer.js ***!
  \*******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   useElapsedTimer: () => (/* binding */ useElapsedTimer)
/* harmony export */ });
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_0__);


/**
 * Hook to track elapsed time in seconds with mm:ss formatting
 */
function useElapsedTimer(isRunning = false) {
  const [elapsedSeconds, setElapsedSeconds] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(0);
  const startTimeRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useRef)(null);
  const timerRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useRef)(null);
  const elapsedRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useRef)(0);
  const startTimer = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useCallback)(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    startTimeRef.current = Date.now() - elapsedRef.current * 1000;
    timerRef.current = setInterval(() => {
      const now = Date.now();
      const secs = Math.floor((now - startTimeRef.current) / 1000);
      elapsedRef.current = secs;
      setElapsedSeconds(secs);
    }, 1000);
  }, []);
  const stopTimer = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useCallback)(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  const resetTimer = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useCallback)(() => {
    stopTimer();
    elapsedRef.current = 0;
    setElapsedSeconds(0);
    startTimeRef.current = null;
  }, [stopTimer]);
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    if (isRunning) {
      startTimer();
    } else {
      stopTimer();
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning, startTimer, stopTimer]);
  const m = Math.floor(elapsedSeconds / 60);
  const s = elapsedSeconds % 60;
  const formattedTimer = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} elapsed`;
  const humanReadable = m > 0 ? `${m}m ${s}s` : `${s}s`;
  return {
    elapsedSeconds,
    formattedTimer,
    humanReadable,
    startTimer,
    stopTimer,
    resetTimer
  };
}

/***/ },

/***/ "./src/bulk/services/batchService.js"
/*!*******************************************!*\
  !*** ./src/bulk/services/batchService.js ***!
  \*******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getActiveBatches: () => (/* binding */ getActiveBatches),
/* harmony export */   getBatchStatus: () => (/* binding */ getBatchStatus)
/* harmony export */ });
/* harmony import */ var _services_api_apiClient__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../services/api/apiClient */ "./src/services/api/apiClient.js");
/* harmony import */ var _services_api_endpoints__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../services/api/endpoints */ "./src/services/api/endpoints.js");
/**
 * Batch Polling and Monitoring Service
 */




/**
 * Fetch batch status and progress
 * @param {string} batchId
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>}
 */
async function getBatchStatus(batchId, signal) {
  return await (0,_services_api_apiClient__WEBPACK_IMPORTED_MODULE_0__.apiRequest)(_services_api_endpoints__WEBPACK_IMPORTED_MODULE_1__.ENDPOINTS.BULK_STATUS, {
    method: 'GET',
    params: {
      batch_id: batchId
    },
    signal
  });
}

/**
 * Fetch currently running active batches
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ batches: Array<Object> }>}
 */
async function getActiveBatches(signal) {
  return await (0,_services_api_apiClient__WEBPACK_IMPORTED_MODULE_0__.apiRequest)(_services_api_endpoints__WEBPACK_IMPORTED_MODULE_1__.ENDPOINTS.BULK_ACTIVE_BATCHES, {
    method: 'GET',
    signal
  });
}

/***/ },

/***/ "./src/bulk/services/bulkService.js"
/*!******************************************!*\
  !*** ./src/bulk/services/bulkService.js ***!
  \******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   skipBulkPost: () => (/* binding */ skipBulkPost),
/* harmony export */   startBulkTranslation: () => (/* binding */ startBulkTranslation),
/* harmony export */   updateBulkJob: () => (/* binding */ updateBulkJob)
/* harmony export */ });
/* harmony import */ var _services_api_apiClient__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../services/api/apiClient */ "./src/services/api/apiClient.js");
/* harmony import */ var _services_api_endpoints__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../services/api/endpoints */ "./src/services/api/endpoints.js");
/**
 * Bulk Translation Service
 */




/**
 * Start a bulk translation batch
 * @param {Object} payload
 * @param {number[]} payload.post_ids
 * @param {string[]} payload.target_languages
 * @param {string} payload.provider
 * @returns {Promise<{ batch_id: string, jobs: Array, total_jobs: number }>}
 */
async function startBulkTranslation(payload) {
  return await (0,_services_api_apiClient__WEBPACK_IMPORTED_MODULE_0__.apiRequest)(_services_api_endpoints__WEBPACK_IMPORTED_MODULE_1__.ENDPOINTS.BULK_START, {
    method: 'POST',
    data: payload
  });
}

/**
 * Update an individual bulk translation job
 * @param {number} jobId
 * @param {Object} data
 * @returns {Promise<{ success: boolean }>}
 */
async function updateBulkJob(jobId, data) {
  return await (0,_services_api_apiClient__WEBPACK_IMPORTED_MODULE_0__.apiRequest)(_services_api_endpoints__WEBPACK_IMPORTED_MODULE_1__.ENDPOINTS.BULK_UPDATE_JOB, {
    method: 'POST',
    data: {
      job_id: jobId,
      data
    }
  });
}

/**
 * Skip remaining translations for a post in a batch
 * @param {string} batchId
 * @param {number} postId
 * @returns {Promise<{ success: boolean, skipped_count: number }>}
 */
async function skipBulkPost(batchId, postId) {
  return await (0,_services_api_apiClient__WEBPACK_IMPORTED_MODULE_0__.apiRequest)(_services_api_endpoints__WEBPACK_IMPORTED_MODULE_1__.ENDPOINTS.BULK_SKIP_POST, {
    method: 'POST',
    data: {
      batch_id: batchId,
      post_id: Number(postId)
    }
  });
}

/***/ },

/***/ "./src/bulk/utils/bulkCalculations.js"
/*!********************************************!*\
  !*** ./src/bulk/utils/bulkCalculations.js ***!
  \********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   calculateBatchStats: () => (/* binding */ calculateBatchStats),
/* harmony export */   getOverallProgress: () => (/* binding */ getOverallProgress),
/* harmony export */   getPostProgress: () => (/* binding */ getPostProgress)
/* harmony export */ });
/**
 * Pure calculation functions for Bulk Translation progress and statistics
 */

/**
 * Calculates progress percentage for a single post item.
 *
 * @param {Object} item
 * @param {string} [item.status]
 * @param {number} [item.total_strings]
 * @param {number} [item.completed_strings]
 * @param {number} [item.progress_percent]
 * @returns {number} Integer between 0 and 100
 */
function getPostProgress(item) {
  if (!item || typeof item !== 'object') return 0;
  const status = String(item.status || '').toLowerCase();

  // Terminal states represent 100% resolution of that specific job
  if (status === 'completed' || status === 'already_exists' || status === 'skipped' || status === 'failed') {
    return 100;
  }

  // If explicit progress_percent is provided by server
  if (typeof item.progress_percent === 'number' && !isNaN(item.progress_percent)) {
    return Math.max(0, Math.min(100, Math.round(item.progress_percent)));
  }
  const total = Number(item.total_strings) || 0;
  const completed = Number(item.completed_strings) || 0;
  if (total > 0) {
    const calculated = Math.round(completed / total * 100);
    // While in progress, clamp below 100 until fully completed
    return Math.max(status === 'running' || status === 'processing' ? 5 : 0, Math.min(99, calculated));
  }
  if (status === 'running' || status === 'processing') {
    return 15;
  }
  return 0;
}

/**
 * Calculate post-weighted overall progress percentage across all batch items.
 *
 * @param {Array<Object>} items
 * @returns {number} Integer between 0 and 100
 */
function getOverallProgress(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return 0;
  }
  let totalWeightedProgress = 0;
  for (let i = 0; i < items.length; i++) {
    totalWeightedProgress += getPostProgress(items[i]);
  }
  const overall = Math.round(totalWeightedProgress / items.length);
  return Math.max(0, Math.min(100, overall));
}

/**
 * Aggregates statistics across an array of batch jobs or translations.
 *
 * @param {Array<Object>} items
 * @returns {{
 *   total: number,
 *   completed: number,
 *   failed: number,
 *   skipped: number,
 *   alreadyExists: number,
 *   pending: number,
 *   running: number,
 *   totalCharacters: number,
 *   completedCharacters: number
 * }}
 */
function calculateBatchStats(items) {
  const stats = {
    total: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    alreadyExists: 0,
    pending: 0,
    running: 0,
    totalCharacters: 0,
    completedCharacters: 0
  };
  if (!Array.isArray(items)) return stats;
  stats.total = items.length;
  for (const item of items) {
    const status = String(item.status || 'pending').toLowerCase();
    const chars = Number(item.total_characters || item.totalCharacters) || (item.total_strings ? item.total_strings * 45 : 0);
    const compChars = Number(item.completed_characters || item.completedCharacters) || (item.completed_strings ? item.completed_strings * 45 : 0);
    stats.totalCharacters += chars;
    if (status === 'completed') {
      stats.completed++;
      stats.completedCharacters += compChars || chars;
    } else if (status === 'already_exists') {
      stats.alreadyExists++;
      stats.completedCharacters += compChars || chars;
    } else if (status === 'failed') {
      stats.failed++;
    } else if (status === 'skipped') {
      stats.skipped++;
    } else if (status === 'running' || status === 'processing' || status === 'cancelling') {
      stats.running++;
      stats.completedCharacters += compChars;
    } else {
      stats.pending++;
    }
  }
  if (stats.totalCharacters < stats.completedCharacters) {
    stats.totalCharacters = stats.completedCharacters;
  }
  return stats;
}

/***/ },

/***/ "./src/bulk/utils/bulkFormatters.js"
/*!******************************************!*\
  !*** ./src/bulk/utils/bulkFormatters.js ***!
  \******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getDisplayTitle: () => (/* binding */ getDisplayTitle),
/* harmony export */   getStatusBadgeInfo: () => (/* binding */ getStatusBadgeInfo)
/* harmony export */ });
/* harmony import */ var _utils_html__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../utils/html */ "./src/utils/html.js");
/**
 * Bulk Translation UI Formatters
 */



/**
 * Get status badge CSS class and dashicon for a translation status
 * @param {string} status
 * @returns {{ className: string, icon: string, label: string }}
 */
function getStatusBadgeInfo(status) {
  const s = String(status || 'pending').toLowerCase();
  switch (s) {
    case 'completed':
      return {
        className: 'completed',
        icon: 'dashicons-yes-alt',
        label: 'Completed'
      };
    case 'already_exists':
      return {
        className: 'completed already-exists',
        icon: 'dashicons-yes-alt',
        label: 'Already exists'
      };
    case 'skipped':
      return {
        className: 'skipped',
        icon: 'dashicons-controls-skipforward',
        label: 'Skipped'
      };
    case 'cancelling':
      return {
        className: 'cancelling',
        icon: 'ts-spinner-circle',
        label: 'Cancelling...'
      };
    case 'failed':
      return {
        className: 'failed',
        icon: 'dashicons-dismiss',
        label: 'Failed'
      };
    case 'running':
    case 'processing':
    case 'translating':
      return {
        className: 'translating',
        icon: 'ts-spinner-circle',
        label: 'Translating'
      };
    case 'pending':
    default:
      return {
        className: 'pending',
        icon: 'dashicons-clock',
        label: 'Pending...'
      };
  }
}

/**
 * Safe title display for a translation
 */
function getDisplayTitle(trans, postTitle, postId) {
  if (trans.targetTitle) return trans.targetTitle;
  if (trans.status === 'already_exists' || trans.status === 'completed') {
    return postTitle || `Post #${postId}`;
  }
  if (trans.status === 'failed') return `Post #${postId}`;
  if (trans.status === 'running' || trans.status === 'processing') return 'Translating content...';
  return 'Waiting in queue';
}

/***/ },

/***/ "./src/components/Button/Button.jsx"
/*!******************************************!*\
  !*** ./src/components/Button/Button.jsx ***!
  \******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Button: () => (/* binding */ Button)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);

/**
 * Reusable Button Component
 */

function Button({
  children,
  variant = 'primary',
  // 'primary' | 'secondary' | 'danger' | 'text' | 'disabled'
  size = 'md',
  // 'sm' | 'md' | 'lg'
  icon = null,
  loading = false,
  disabled = false,
  className = '',
  onClick,
  type = 'button',
  title = '',
  ...props
}) {
  const isDisabled = disabled || loading || variant === 'disabled';
  let variantClass = 'ts-btn-primary button-primary';
  if (variant === 'secondary') {
    variantClass = 'ts-btn-secondary button-secondary';
  } else if (variant === 'danger') {
    variantClass = 'ts-btn-danger button-danger';
  } else if (variant === 'text') {
    variantClass = 'ts-btn-text';
  } else if (variant === 'disabled') {
    variantClass = 'ts-btn-disabled';
  }
  const sizeClass = size === 'sm' ? 'ts-btn-sm' : size === 'lg' ? 'ts-btn-lg' : '';
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: type,
    className: `ts-btn ${variantClass} ${sizeClass} ${loading ? 'is-loading' : ''} ${className}`,
    disabled: isDisabled,
    onClick: isDisabled ? undefined : onClick,
    title: title,
    ...props
  }, loading ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-btn-spinner-wrap"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-spinner-circle",
    "aria-hidden": "true"
  }), children) : (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, null, icon && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-btn-icon"
  }, icon), children));
}

/***/ },

/***/ "./src/components/Button/index.js"
/*!****************************************!*\
  !*** ./src/components/Button/index.js ***!
  \****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Button: () => (/* reexport safe */ _Button__WEBPACK_IMPORTED_MODULE_0__.Button)
/* harmony export */ });
/* harmony import */ var _Button__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./Button */ "./src/components/Button/Button.jsx");


/***/ },

/***/ "./src/components/ConfirmDialog/ConfirmDialog.jsx"
/*!********************************************************!*\
  !*** ./src/components/ConfirmDialog/ConfirmDialog.jsx ***!
  \********************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ConfirmDialog: () => (/* binding */ ConfirmDialog)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _Modal__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../Modal */ "./src/components/Modal/index.js");
/* harmony import */ var _Button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../Button */ "./src/components/Button/index.js");

/**
 * Reusable Confirmation Dialog Component
 */



function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDanger = false,
  loading = false,
  icon = 'dashicons-warning'
}) {
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_Modal__WEBPACK_IMPORTED_MODULE_1__.Modal, {
    isOpen: isOpen,
    onClose: loading ? undefined : onClose,
    className: "ts-confirm-dialog",
    closeOnBackdrop: !loading,
    closeOnEscape: !loading
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-confirm-dialog-content"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-confirm-icon-wrap"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: `dashicons ${icon} ${isDanger ? 'text-danger' : 'text-warning'}`
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-confirm-text-wrap"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h3", {
    className: "ts-confirm-title"
  }, title), message && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-confirm-message"
  }, message))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-confirm-actions"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_Button__WEBPACK_IMPORTED_MODULE_2__.Button, {
    variant: "secondary",
    onClick: onClose,
    disabled: loading
  }, cancelLabel), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_Button__WEBPACK_IMPORTED_MODULE_2__.Button, {
    variant: isDanger ? 'danger' : 'primary',
    onClick: onConfirm,
    loading: loading
  }, confirmLabel)));
}

/***/ },

/***/ "./src/components/ConfirmDialog/index.js"
/*!***********************************************!*\
  !*** ./src/components/ConfirmDialog/index.js ***!
  \***********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ConfirmDialog: () => (/* reexport safe */ _ConfirmDialog__WEBPACK_IMPORTED_MODULE_0__.ConfirmDialog)
/* harmony export */ });
/* harmony import */ var _ConfirmDialog__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./ConfirmDialog */ "./src/components/ConfirmDialog/ConfirmDialog.jsx");


/***/ },

/***/ "./src/components/CopyToClipbord/index.js"
/*!************************************************!*\
  !*** ./src/components/CopyToClipbord/index.js ***!
  \************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
const copyToClipboard = async ({
  value = '',
  onCopy = () => {},
  onClose = () => {},
  onSuccess = () => {},
  onError = () => {},
  resetDelay = 1000
} = {}) => {
  if (value == null || value === '') return false;
  try {
    const text = String(value);
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      textarea.remove();
      if (!copied) {
        console.error('Unable to copy text.');
      }
    }
    if (typeof onCopy === 'function') onCopy();
    if (typeof onClose === 'function') onClose();
    if (resetDelay > 0) {
      setTimeout(onSuccess, resetDelay);
    } else {
      onSuccess();
    }
    return true;
  } catch (error) {
    if (typeof onError === 'function') {
      onError(error);
    }
    return false;
  }
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (copyToClipboard);

/***/ },

/***/ "./src/components/ErrorModal/ErrorModal.jsx"
/*!**************************************************!*\
  !*** ./src/components/ErrorModal/ErrorModal.jsx ***!
  \**************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ErrorModal: () => (/* binding */ ErrorModal)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _Modal__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../Modal */ "./src/components/Modal/index.js");
/* harmony import */ var _Button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../Button */ "./src/components/Button/index.js");
/* harmony import */ var _CopyToClipbord__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../CopyToClipbord */ "./src/components/CopyToClipbord/index.js");

/**
 * Reusable ErrorModal Component
 */





function ErrorModal({
  isOpen,
  onClose,
  title = 'Translation Error',
  message,
  reasonHTML = '',
  actionHtml = '',
  icon = 'dashicons-warning',
  onRetry = null,
  retryLabel = 'Retry'
}) {
  if (!isOpen) return null;
  const addToolTip = toolTip => {
    if (!toolTip) return;
    if (toolTip.parentElement) {
      toolTip.parentElement.style.position = 'relative';
    }
    toolTip.innerHTML = `
      <span class="ts-tooltip-arrow" aria-hidden="true"></span>
      <span class="ts-copy-spinner" aria-hidden="true"></span>
      <span class="ts-copy-text">Copied!</span>
    `;

    // Trigger smooth translation effect on entrance
    requestAnimationFrame(() => {
      toolTip.classList.add('ts-tooltip-visible');
    });
  };
  const hideToolTip = toolTip => {
    if (!toolTip) return;

    // Trigger smooth translation effect on exit
    toolTip.classList.remove('ts-tooltip-visible');
    toolTip.classList.add('ts-tooltip-hiding');
    setTimeout(() => {
      if (toolTip.parentNode) {
        toolTip.remove();
      }
    }, 220);
  };
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    const copyBtns = Array.from(document.querySelectorAll('.ts-copy-clipboard'));
    const handleCopyClick = e => {
      e.preventDefault();
      if (!e.target) return;
      const targetEle = e.target.classList.contains('ts-copy-clipboard') ? e.target : e.target.closest('.ts-copy-clipboard');
      if (targetEle) {
        const copyText = targetEle.dataset.copyText;
        if (copyText && copyText !== '') {
          const existingToolTip = targetEle.querySelector('.ts-copy-tooltip');
          if (existingToolTip) {
            existingToolTip.remove();
          }
          const toolTIp = document.createElement('div');
          toolTIp.className = 'ts-copy-tooltip';
          targetEle.append(toolTIp);
          (0,_CopyToClipbord__WEBPACK_IMPORTED_MODULE_4__["default"])({
            value: copyText,
            onClose: () => {
              addToolTip(toolTIp);
            },
            onCopy: () => {
              addToolTip(toolTIp);
            },
            onSuccess: () => {
              hideToolTip(toolTIp);
            }
          });
        }
      }
    };
    if (copyBtns.length > 0) {
      copyBtns.forEach(ele => ele.addEventListener('click', handleCopyClick));
    }
    return () => {
      if (copyBtns.length > 0) {
        copyBtns.forEach(ele => ele.removeEventListener('click', handleCopyClick));
      }
    };
  }, [reasonHTML, message]);
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_Modal__WEBPACK_IMPORTED_MODULE_2__.Modal, {
    isOpen: isOpen,
    onClose: onClose,
    className: "ts-error-container",
    overlayClassName: "ts-error-modal-overlay",
    header: (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_Modal__WEBPACK_IMPORTED_MODULE_2__.ModalHeader, {
      icon: icon,
      title: title,
      onClose: onClose,
      closeClass: "ts-bulk-close"
    }),
    footer: (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_Modal__WEBPACK_IMPORTED_MODULE_2__.ModalFooter, {
      customHtml: actionHtml,
      align: actionHtml ? 'space-between' : 'right'
    }, onRetry && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_Button__WEBPACK_IMPORTED_MODULE_3__.Button, {
      variant: "secondary",
      onClick: onRetry
    }, retryLabel), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_Button__WEBPACK_IMPORTED_MODULE_3__.Button, {
      variant: "primary",
      onClick: onClose
    }, "Close"))
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-error-content-body"
  }, reasonHTML ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-error-message",
    dangerouslySetInnerHTML: {
      __html: reasonHTML
    }
  }) : message ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-error-notice-card"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "dashicons dashicons-warning"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    className: "ts-error-text"
  }, message)) : null));
}

/***/ },

/***/ "./src/components/ErrorModal/index.js"
/*!********************************************!*\
  !*** ./src/components/ErrorModal/index.js ***!
  \********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ErrorModal: () => (/* reexport safe */ _ErrorModal__WEBPACK_IMPORTED_MODULE_0__.ErrorModal)
/* harmony export */ });
/* harmony import */ var _ErrorModal__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./ErrorModal */ "./src/components/ErrorModal/ErrorModal.jsx");


/***/ },

/***/ "./src/components/LanguageSelector/LanguageSelector.jsx"
/*!**************************************************************!*\
  !*** ./src/components/LanguageSelector/LanguageSelector.jsx ***!
  \**************************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   LanguageSelector: () => (/* binding */ LanguageSelector)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _utils_language__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../utils/language */ "./src/utils/language.js");

/**
 * LanguageSelector Component
 */


function LanguageSelector({
  languages = [],
  selectedLanguages = [],
  onChange,
  className = ''
}) {
  const handleToggle = slug => {
    if (!onChange) return;
    const isSelected = selectedLanguages.includes(slug);
    if (isSelected) {
      onChange(selectedLanguages.filter(s => s !== slug));
    } else {
      onChange([...selectedLanguages, slug]);
    }
  };
  const handleSelectAll = () => {
    if (!onChange) return;
    const defaultLang = typeof window !== 'undefined' && (window.TranslateSenseBulkData?.defaultLanguage || window.TranslateSenseEditorData?.defaultLanguage) || '';
    const nonDefaultLangs = languages.filter(l => !l.is_default && l.slug !== defaultLang);
    onChange(nonDefaultLangs.length > 0 ? nonDefaultLangs.map(l => l.slug) : languages.map(l => l.slug));
  };
  const handleUnselectAll = () => {
    if (!onChange) return;
    onChange([]);
  };
  const isGridCols3 = languages.length > 6;
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: `ts-language-selector ${className}`
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-lang-actions"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-lang-btn-group"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-lang-action-btn",
    onClick: handleSelectAll
  }, "Select All"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-lang-action-btn",
    onClick: handleUnselectAll
  }, "Unselect All")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-lang-counter"
  }, selectedLanguages.length, " of ", languages.length, " selected")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: `ts-lang-grid ${isGridCols3 ? 'cols-3' : 'cols-2'}`
  }, languages.map(lang => {
    const isChecked = selectedLanguages.includes(lang.slug);
    const flagInfo = (0,_utils_language__WEBPACK_IMPORTED_MODULE_1__.getLanguageFlag)(lang, languages);
    return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
      key: lang.slug,
      className: `ts-lang-card ${isChecked ? 'selected' : ''}`,
      onClick: () => handleToggle(lang.slug)
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("input", {
      type: "checkbox",
      id: `ts-lang-${lang.slug}`,
      name: "ts_target_langs[]",
      className: "ts-lang-checkbox",
      value: lang.slug,
      checked: isChecked,
      onChange: () => {} // Controlled via card click
    }), flagInfo.hasFlag ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("img", {
      src: flagInfo.flagUrl,
      alt: "",
      className: "ts-lang-flag-img"
    }) : null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: "ts-lang-name",
      title: lang.name
    }, lang.name), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: "ts-lang-code"
    }, (0,_utils_language__WEBPACK_IMPORTED_MODULE_1__.getLanguageDisplay)(lang, languages)));
  })));
}

/***/ },

/***/ "./src/components/LanguageSelector/index.js"
/*!**************************************************!*\
  !*** ./src/components/LanguageSelector/index.js ***!
  \**************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   LanguageSelector: () => (/* reexport safe */ _LanguageSelector__WEBPACK_IMPORTED_MODULE_0__.LanguageSelector)
/* harmony export */ });
/* harmony import */ var _LanguageSelector__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./LanguageSelector */ "./src/components/LanguageSelector/LanguageSelector.jsx");


/***/ },

/***/ "./src/components/Modal/Modal.jsx"
/*!****************************************!*\
  !*** ./src/components/Modal/Modal.jsx ***!
  \****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Modal: () => (/* binding */ Modal)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _ModalHeader__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./ModalHeader */ "./src/components/Modal/ModalHeader.jsx");
/* harmony import */ var _ModalBody__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./ModalBody */ "./src/components/Modal/ModalBody.jsx");
/* harmony import */ var _ModalFooter__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./ModalFooter */ "./src/components/Modal/ModalFooter.jsx");

/**
 * Reusable Modal Container Component
 * Renders the modal container with accessibility attributes, header, body, and footer.
 */





function Modal({
  isOpen = true,
  onClose,
  title,
  subtitle,
  icon,
  children,
  header,
  footer,
  buttons,
  size = '',
  // 'sm' | 'md' | 'lg' | 'xl' | 'custom'
  maxWidth = null,
  closeOnEscape = true,
  className = '',
  dataStep = null
}) {
  const containerRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useRef)(null);

  // Handle Escape key
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (!isOpen || !closeOnEscape || !onClose) return;
    const handleKeyDown = e => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeOnEscape, onClose]);
  if (!isOpen) return null;
  const sizeStyles = {
    sm: {
      maxWidth: '420px'
    },
    md: {
      maxWidth: '580px'
    },
    lg: {
      maxWidth: '820px'
    },
    xl: {
      maxWidth: '1040px'
    }
  };
  const containerStyle = {
    ...(maxWidth ? {
      maxWidth
    } : sizeStyles[size] || '')
  };
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    ref: containerRef,
    className: `ts-modal-container ${className}`,
    style: containerStyle,
    "data-step": dataStep || undefined,
    onClick: e => e.stopPropagation(),
    role: "dialog",
    "aria-modal": "true"
  }, header !== undefined ? header : title ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_ModalHeader__WEBPACK_IMPORTED_MODULE_2__.ModalHeader, {
    title: title,
    subtitle: subtitle,
    icon: icon,
    onClose: onClose
  }) : null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_ModalBody__WEBPACK_IMPORTED_MODULE_3__.ModalBody, null, children), footer !== undefined ? footer : buttons && buttons.length > 0 ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_ModalFooter__WEBPACK_IMPORTED_MODULE_4__.ModalFooter, {
    buttons: buttons
  }) : null);
}
Modal.Header = _ModalHeader__WEBPACK_IMPORTED_MODULE_2__.ModalHeader;
Modal.Body = _ModalBody__WEBPACK_IMPORTED_MODULE_3__.ModalBody;
Modal.Footer = _ModalFooter__WEBPACK_IMPORTED_MODULE_4__.ModalFooter;

/***/ },

/***/ "./src/components/Modal/ModalBody.jsx"
/*!********************************************!*\
  !*** ./src/components/Modal/ModalBody.jsx ***!
  \********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ModalBody: () => (/* binding */ ModalBody)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);

/**
 * ModalBody Component
 */

function ModalBody({
  children,
  className = '',
  style = {}
}) {
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: `ts-modal-body ts-common-body ${className}`,
    style: style
  }, children);
}

/***/ },

/***/ "./src/components/Modal/ModalFooter.jsx"
/*!**********************************************!*\
  !*** ./src/components/Modal/ModalFooter.jsx ***!
  \**********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ModalFooter: () => (/* binding */ ModalFooter)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _Button__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../Button */ "./src/components/Button/index.js");

/**
 * ModalFooter Component
 */


function ModalFooter({
  children,
  buttons = [],
  customHtml = null,
  align = 'right',
  // 'right' | 'space-between' | 'center'
  className = '',
  style = {},
  id = ''
}) {
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    id: id || undefined,
    className: `ts-modal-footer ts-common-footer ${className}`,
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: align === 'space-between' ? 'space-between' : align === 'center' ? 'center' : 'flex-end',
      ...style
    }
  }, customHtml && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-footer-custom-content"
  }, typeof customHtml === 'string' ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    dangerouslySetInnerHTML: {
      __html: customHtml
    }
  }) : customHtml), children, buttons.length > 0 && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-footer-buttons-group"
  }, buttons.map((btn, idx) => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_Button__WEBPACK_IMPORTED_MODULE_1__.Button, {
    key: btn.id || btn.label || idx,
    id: btn.id,
    variant: btn.variant || (btn.primary ? 'primary' : 'secondary'),
    disabled: btn.disabled,
    loading: btn.loading,
    onClick: btn.onClick,
    title: btn.title,
    className: btn.className || btn.class,
    ...(btn.attributes || {})
  }, typeof btn.label === 'string' && btn.label.includes('&') ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    dangerouslySetInnerHTML: {
      __html: btn.label
    }
  }) : btn.label))));
}

/***/ },

/***/ "./src/components/Modal/ModalHeader.jsx"
/*!**********************************************!*\
  !*** ./src/components/Modal/ModalHeader.jsx ***!
  \**********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ModalHeader: () => (/* binding */ ModalHeader)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);

/**
 * ModalHeader Component
 */

function ModalHeader({
  title,
  subtitle = '',
  icon = null,
  onClose,
  showClose = true,
  className = '',
  closeId = '',
  closeClass = ''
}) {
  if (!icon || icon === '') {
    const config = window.TranslateSenseEditorData || window.TranslateSenseBulkData || {};
    if (config && config.pluginUrl) {
      icon = config.pluginUrl + 'assets/img/logo.png';
    }
  }
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: `ts-modal-header ts-common-header ${className}`
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-header-title-group"
  }, icon && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-header-icon-box"
  }, typeof icon === 'string' && (icon.startsWith('http') || icon.endsWith('.png') || icon.endsWith('.svg')) ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("img", {
    src: icon,
    alt: "",
    className: "ts-header-icon-img"
  }) : typeof icon === 'string' && icon.startsWith('dashicons-') ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: `dashicons ${icon}`
  }) : icon), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-header-text-wrap"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h2", {
    className: "ts-modal-title ts-common-title"
  }, title), subtitle && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    className: "ts-modal-subtitle ts-common-subtitle"
  }, subtitle))), showClose && onClose && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    id: closeId || undefined,
    className: `ts-modal-close-btn ts-bulk-close ${closeClass}`,
    onClick: onClose,
    "aria-label": "Close modal",
    title: "Close modal"
  }, "\xD7"));
}

/***/ },

/***/ "./src/components/Modal/index.js"
/*!***************************************!*\
  !*** ./src/components/Modal/index.js ***!
  \***************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Modal: () => (/* reexport safe */ _Modal__WEBPACK_IMPORTED_MODULE_0__.Modal),
/* harmony export */   ModalBody: () => (/* reexport safe */ _ModalBody__WEBPACK_IMPORTED_MODULE_2__.ModalBody),
/* harmony export */   ModalFooter: () => (/* reexport safe */ _ModalFooter__WEBPACK_IMPORTED_MODULE_3__.ModalFooter),
/* harmony export */   ModalHeader: () => (/* reexport safe */ _ModalHeader__WEBPACK_IMPORTED_MODULE_1__.ModalHeader)
/* harmony export */ });
/* harmony import */ var _Modal__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./Modal */ "./src/components/Modal/Modal.jsx");
/* harmony import */ var _ModalHeader__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./ModalHeader */ "./src/components/Modal/ModalHeader.jsx");
/* harmony import */ var _ModalBody__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./ModalBody */ "./src/components/Modal/ModalBody.jsx");
/* harmony import */ var _ModalFooter__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./ModalFooter */ "./src/components/Modal/ModalFooter.jsx");





/***/ },

/***/ "./src/components/ProgressBar/ProgressBar.jsx"
/*!****************************************************!*\
  !*** ./src/components/ProgressBar/ProgressBar.jsx ***!
  \****************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ProgressBar: () => (/* binding */ ProgressBar)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);

/**
 * Reusable ProgressBar Component
 */

function ProgressBar({
  percent = 0,
  status = '',
  subText = '',
  meta = null,
  showBadge = true,
  className = ''
}) {
  const clampedPercent = Math.min(100, Math.max(0, Math.round(percent || 0)));
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: `ts-progress-component ${className}`
  }, (status || showBadge || meta) && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-progress-header"
  }, status && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-progress-status"
  }, status), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-progress-meta"
  }, showBadge && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-progress-percent"
  }, clampedPercent, "%"), meta)), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-progress-bar-bg"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-progress-bar-fill",
    style: {
      width: `${clampedPercent}%`
    },
    role: "progressbar",
    "aria-valuenow": clampedPercent,
    "aria-valuemin": "0",
    "aria-valuemax": "100"
  })), subText && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-progress-sub-info"
  }, subText));
}

/***/ },

/***/ "./src/components/ProgressBar/index.js"
/*!*********************************************!*\
  !*** ./src/components/ProgressBar/index.js ***!
  \*********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ProgressBar: () => (/* reexport safe */ _ProgressBar__WEBPACK_IMPORTED_MODULE_0__.ProgressBar)
/* harmony export */ });
/* harmony import */ var _ProgressBar__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./ProgressBar */ "./src/components/ProgressBar/ProgressBar.jsx");


/***/ },

/***/ "./src/components/ProviderCard/ProviderCard.jsx"
/*!******************************************************!*\
  !*** ./src/components/ProviderCard/ProviderCard.jsx ***!
  \******************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ProviderCard: () => (/* binding */ ProviderCard)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);

/**
 * Reusable ProviderCard Component
 */

function ProviderCard({
  provider,
  isSelected = false,
  onSelect,
  onViewError,
  name = 'ts_provider_choice',
  className = ''
}) {
  const {
    id,
    title,
    logo,
    desc,
    isAvailable,
    badgeType,
    badgeText,
    actionUrl,
    isSupported
  } = provider;
  const isDisabled = !isAvailable;
  const hasErrorModal = isSupported && isSupported.available === false && isSupported.reason;
  const handleCardClick = e => {
    if (id === 'chrome_ai' && (badgeType === 'error' || hasErrorModal)) {
      handleErrorBtnClick(e);
      return;
    }
    if (isDisabled || !onSelect) return;
    onSelect(id);
  };
  const handleActionClick = e => {
    e.stopPropagation();
  };
  const handleErrorBtnClick = e => {
    e.stopPropagation();
    if (onViewError) {
      onViewError(provider);
    }
  };
  const hasError = badgeType === 'error' || hasErrorModal;
  if ('' !== className) {
    className = ' ' + className;
  }
  if (hasError) {
    className += ' ts-provider-error-btn';
  }
  if (isSelected && !isDisabled) {
    className += ' selected';
  }
  if (isDisabled) {
    className += ' disabled';
  }
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: `ts-provider-row${className}`,
    "data-provider": id,
    "data-disabled": isDisabled ? 'true' : undefined,
    onClick: handleCardClick
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-provider-card-top"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-provider-icon-box"
  }, logo && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("img", {
    src: logo,
    alt: title,
    className: "ts-provider-logo-img"
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-provider-header-content"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-provider-name"
  }, title), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-provider-badge-wrap"
  }, hasError ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-provider-badge error-badge ts-provider-error-btn",
    title: desc,
    onClick: handleErrorBtnClick
  }, "\u26A0\uFE0F View Error") : actionUrl ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("a", {
    href: actionUrl,
    target: "_blank",
    rel: "noopener noreferrer",
    className: "ts-provider-badge error-badge api-required",
    onClick: handleActionClick,
    title: badgeText
  }, badgeText) : (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: `ts-provider-badge ${badgeType}`
  }, badgeText))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-provider-radio-wrap"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("input", {
    type: "radio",
    id: `ts-provider-${id}`,
    name: name,
    value: id,
    checked: isSelected,
    disabled: isDisabled,
    onChange: () => onSelect && onSelect(id),
    className: "ts-provider-radio-input"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-provider-custom-radio"
  }))), desc && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    className: "ts-provider-caption"
  }, desc));
}

/***/ },

/***/ "./src/components/ProviderCard/index.js"
/*!**********************************************!*\
  !*** ./src/components/ProviderCard/index.js ***!
  \**********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ProviderCard: () => (/* reexport safe */ _ProviderCard__WEBPACK_IMPORTED_MODULE_0__.ProviderCard)
/* harmony export */ });
/* harmony import */ var _ProviderCard__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./ProviderCard */ "./src/components/ProviderCard/ProviderCard.jsx");


/***/ },

/***/ "./src/services/api/apiClient.js"
/*!***************************************!*\
  !*** ./src/services/api/apiClient.js ***!
  \***************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ApiError: () => (/* binding */ ApiError),
/* harmony export */   apiRequest: () => (/* binding */ apiRequest),
/* harmony export */   getApiConfig: () => (/* binding */ getApiConfig)
/* harmony export */ });
/**
 * Centralized API Client for TranslateSense
 */

/**
 * Get localized configuration and nonce
 * @returns {{ restUrl: string, nonce: string }}
 */
function getApiConfig() {
  if (typeof window === 'undefined') {
    return {
      restUrl: '/wp-json/translatesense/v1/',
      nonce: ''
    };
  }
  const globalConfig = window.TranslateSenseData || window.TranslateSenseBulkData || window.TranslateSenseEditorData || {};
  let restUrl = globalConfig.restUrl || '/wp-json/translatesense/v1/';
  if (!restUrl.endsWith('/')) {
    restUrl += '/';
  }
  const nonce = globalConfig.nonce || window.wpApiSettings && window.wpApiSettings.nonce || '';
  return {
    restUrl,
    nonce
  };
}

/**
 * Standardized API error
 */
class ApiError extends Error {
  constructor(message, status = 500, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Performs a REST API request to TranslateSense
 *
 * @param {string} endpoint - API endpoint (without leading slash or namespace)
 * @param {Object} [options={}] - Request options
 * @param {string} [options.method='GET']
 * @param {Object|null} [options.data=null] - Request body (for POST/PUT)
 * @param {Object} [options.params={}] - Query parameters (for GET)
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<any>}
 */
async function apiRequest(endpoint, options = {}) {
  const {
    method = 'GET',
    data = null,
    params = {},
    signal
  } = options;
  const {
    restUrl,
    nonce
  } = getApiConfig();

  // If wp.apiFetch is available and we're in the WordPress admin
  if (typeof window !== 'undefined' && window.wp && typeof window.wp.apiFetch === 'function') {
    try {
      const cleanEndpoint = endpoint.replace(/^\/+/, '');
      const path = `/translatesense/v1/${cleanEndpoint}`;
      const fetchOptions = {
        path,
        method,
        signal
      };
      if (data && method !== 'GET') {
        fetchOptions.data = data;
      }

      // Append query params if GET
      if (params && Object.keys(params).length > 0) {
        const queryStr = new URLSearchParams(params).toString();
        fetchOptions.path = `${path}?${queryStr}`;
      }
      return await window.wp.apiFetch(fetchOptions);
    } catch (err) {
      const message = err.message || err.code || 'API request failed';
      const status = err.status || err.data && err.data.status || 500;
      console.error(message, status, err);
    }
  }

  // Fallback to native fetch
  let fullUrl = `${restUrl}${endpoint.replace(/^\/+/, '')}`;
  if (params && Object.keys(params).length > 0) {
    const queryStr = new URLSearchParams(params).toString();
    fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryStr;
  }
  const headers = {
    'Content-Type': 'application/json',
    'X-WP-Nonce': nonce
  };
  const fetchConfig = {
    method,
    headers,
    signal
  };
  if (data && method !== 'GET') {
    fetchConfig.body = JSON.stringify(data);
  }
  let response;
  try {
    response = await fetch(fullUrl, fetchConfig);
  } catch (netErr) {
    console.error(`Network error: ${netErr.message}`, 0, netErr);
  }
  let resData;
  try {
    resData = await response.json();
  } catch {
    resData = null;
  }
  if (!response.ok) {
    const errorMsg = resData && (resData.message || resData.error) || `HTTP Error ${response.status}: ${response.statusText}`;
    console.error(errorMsg, response.status, resData);
  }
  return resData;
}

/***/ },

/***/ "./src/services/api/endpoints.js"
/*!***************************************!*\
  !*** ./src/services/api/endpoints.js ***!
  \***************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ENDPOINTS: () => (/* binding */ ENDPOINTS)
/* harmony export */ });
/**
 * TranslateSense REST API Endpoints
 */

const ENDPOINTS = {
  WIDGETS: 'widgets',
  XML_CONFIG: 'xml-config',
  SETTINGS: 'settings',
  CACHE_STATS: 'cache-stats',
  CLEAR_CACHE: 'clear-cache',
  OPEN_MAPPING_SANDBOX: 'open-mapping-sandbox',
  EXTRACT_STRINGS: 'extract-strings',
  TRANSLATE_BATCH: 'translate-batch',
  TRANSLATE_POST: 'translate-post',
  BULK_START: 'bulk-start',
  BULK_STATUS: 'bulk-status',
  BULK_UPDATE_JOB: 'bulk-update-job',
  BULK_SKIP_POST: 'bulk-skip-post',
  BULK_ACTIVE_BATCHES: 'bulk-active-batches',
  MARK_TRANSLATED: 'mark-translated'
};

/***/ },

/***/ "./src/services/core/coreInstance.js"
/*!*******************************************!*\
  !*** ./src/services/core/coreInstance.js ***!
  \*******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
class TranslateSenseCore {
  constructor() {
    this.providers = new Map();
    this.pageEditors = new Map();
    this.sourceStrings = new Map();
    this.translatedStrings = new Map();
    this.activeControllers = new Set();
    this.defaultProvider = '';
    this.enabledProviders = ['chrome_ai', 'openai', 'gemini'];
    this.registerProviders();
    this.registerEditors();
    // Initialize enabled providers from localized data if available
    this.syncEnabledProviders();
  }
  registerProviders() {
    if (window.TranslateSenseProviders && typeof window.TranslateSenseProviders.register === 'function') {
      window.TranslateSenseProviders.register(this);
    }
  }
  registerEditors() {
    if (window.TranslateSensePageEditors && typeof window.TranslateSensePageEditors.register === 'function') {
      window.TranslateSensePageEditors.register(this);
    }
  }

  /**
   * Generate MD5 hash for a string and widget/block name using SparkMD5 or internal fallback.
   * 
   * @param {string} widgetOrBlockName Block name or Elementor widget type
   * @param {string} stringValue Source string value
   * @returns {string} 32-character hexadecimal MD5 hash
   */
  generateHash(widgetOrBlockName = '', stringValue = '') {
    const payload = (widgetOrBlockName ? String(widgetOrBlockName).trim() : '') + '_' + (stringValue !== undefined ? String(stringValue) : '');
    if (typeof window !== 'undefined' && window.SparkMD5 && typeof window.SparkMD5.hash === 'function') {
      return window.SparkMD5.hash(payload);
    }
    console.error("SparkMD5 is not loaded");
  }

  /**
   * Save a source string with ID and source value.
   * 
   * @param {string} id Unique identifier or field name
   * @param {string} sourceValue Raw source string text
   * @param {string} [widgetOrBlockName=''] Block name, widget name, or module name
   * @returns {Object} Saved source string record { id, source, widget_id, hash, timestamp }
   */
  saveSourceString(id, sourceValue, widgetOrBlockName = '') {
    const widget = widgetOrBlockName || id || 'generic';
    const hash = this.generateHash(widget, sourceValue);
    const entry = {
      id: id || hash,
      source: sourceValue !== undefined ? String(sourceValue) : '',
      widget_id: widget,
      hash: hash,
      timestamp: Date.now()
    };
    this.sourceStrings.set(hash, entry);
    if (id && id !== hash) {
      this.sourceStrings.set(id, entry);
    }
    return entry;
  }

  /**
   * Save a translated string with ID, source value, translated value, and provider.
   * 
   * @param {string} id Unique identifier or field name
   * @param {string} sourceValue Raw source string text
   * @param {string} translatedValue Translated string text
   * @param {string} [provider='default'] Translation provider ID (e.g. 'openai', 'gemini', 'chrome_ai')
   * @param {string} [widgetOrBlockName=''] Block name, widget name, or module name
   * @returns {Object} Saved translated string record
   */
  saveTranslatedString(id, sourceValue, filterValue, translatedValue, provider = 'default', widgetOrBlockName = '') {
    const widget = widgetOrBlockName || id || 'generic';
    const hash = this.generateHash(widget, filterValue);
    const entry = {
      id: id || hash,
      source: sourceValue !== undefined ? String(sourceValue) : '',
      filterValue: filterValue !== undefined ? String(filterValue) : '',
      translated: translatedValue !== undefined ? String(translatedValue) : '',
      provider: provider || 'default',
      widget_id: widget,
      hash: hash,
      timestamp: Date.now()
    };

    // Save by provider-specific composite key and generic hash
    this.translatedStrings.set(`${hash}_${provider}`, entry);
    this.translatedStrings.set(hash, entry);
    return entry;
  }

  /**
   * Get all registered source and translated strings.
   * 
   * @returns {{ source: Array<Object>, translated: Array<Object>, all: Array<Object> }}
   */
  getAllStrings() {
    const sourceList = Array.from(new Set(this.sourceStrings.values()));
    const translatedList = Array.from(new Set(this.translatedStrings.values()));

    // Composite list linking source with available translations
    const all = sourceList.map(src => {
      const trans = this.getTranslatedString(src.id, src.value, null, src.widget_id);
      return {
        ...src,
        translated: trans || ''
      };
    });
    return {
      source: sourceList,
      translated: translatedList,
      all: all
    };
  }

  /** 
  * Get all translated strings
  */
  getTranslatedStrings() {
    return new Map(this.translatedStrings);
  }

  /**
   * Get translated string by ID, source value, and optional provider.
   * 
   * @param {string} id Unique identifier or field name
   * @param {string} [sourceValue=''] Source string value
   * @param {string} [provider=null] Specific provider ID or null for latest
   * @param {string} [widgetOrBlockName=''] Block name, widget name, or module name
   * @returns {string} Translated string content or empty string if not found
   */
  getTranslatedString(id, sourceValue = '', provider = null, widgetOrBlockName = '') {
    const widget = widgetOrBlockName || id || '';
    const hash = this.generateHash(widget, sourceValue);

    // 1. Check by hash + provider
    if (provider && this.translatedStrings.has(`${hash}_${provider}`)) {
      return {
        source: sourceValue,
        translate: this.translatedStrings.get(`${hash}_${provider}`).translated
      };
    }
    let filterValue;
    for (const [key, data] of this.translatedStrings) {
      if (data.filterValue && data.source === sourceValue) {
        filterValue = data.filterValue;
        break;
      }
    }
    if (filterValue) {
      const hash = this.generateHash(widget, filterValue);
      if (provider && this.translatedStrings.has(`${hash}_${provider}`)) {
        return {
          source: sourceValue,
          translate: sourceValue.replace(this.translatedStrings.get(`${hash}_${provider}`).filterValue, this.translatedStrings.get(`${hash}_${provider}`).translated)
        };
      }
    }
    return '';
  }

  /**
   * Get source string record by ID or hash.
   * 
   * @param {string} id
   * @param {string} [sourceValue='']
   * @param {string} [widgetOrBlockName='']
   * @returns {Object|null}
   */
  getSourceString(id, sourceValue = '', widgetOrBlockName = '') {
    const widget = widgetOrBlockName || id || '';
    const hash = this.generateHash(widget, sourceValue);
    return this.sourceStrings.get(hash) || this.sourceStrings.get(id) || null;
  }

  /**
   * Sync enabled providers from localized WordPress global configurations.
   */
  syncEnabledProviders() {
    const config = window.TranslateSenseEditorData || window.TranslateSenseBulkData || {};
    if (config.enabledProviders && Object.keys(config.enabledProviders).length > 0) {
      this.enabledProviders = Object.keys(config.enabledProviders);
    }
    if (config.defaultProvider) {
      this.defaultProvider = config.defaultProvider;
    }
  }

  /**
   * Register a translation provider.
   * 
   * @param {string} id Unique provider ID (e.g. 'chrome_ai', 'openai', 'gemini')
   * @param {Object} options Configuration options
   * @param {string} options.title Display name
   * @param {string} options.icon Emoji or Dashicon icon identifier
   * @param {string} options.desc Brief description
   * @param {string} [options.category='ai'] Category: 'ai' | 'browser' | 'free'
   * @param {Function} [options.checkAvailability] Validation function returning { available: boolean, reason?: string, noticeType?: 'warning'|'error'|'info' }
   * @param {Function} [options.isLanguageSupported] Language support checker (sourceLang, targetLang) -> boolean
   * @param {Function} options.translate Translation function: translate({ items, sourceLang, targetLang, postId, signal }, onProgressCallback) -> Promise<Array>
   */
  registerProvider(id, options) {
    if (!id || typeof id !== 'string') {
      console.error('[TranslateSense] Invalid provider ID:', id);
      return;
    }
    if (!options || typeof options.translate !== 'function') {
      console.error(`[TranslateSense] Provider "${id}" must provide a translate() function.`);
      return;
    }
    const providerData = {
      id,
      title: options.title || id,
      logo: options.logo || '',
      browserType: options.browserType || '',
      desc: options.desc || '',
      category: options.category || 'ai',
      checkAvailability: typeof options.checkAvailability === 'function' ? options.checkAvailability : () => ({
        available: true
      }),
      isLanguageSupported: typeof options.isLanguageSupported === 'function' ? options.isLanguageSupported : () => true,
      translate: options.translate,
      docUrl: options.docUrl || ''
    };
    this.providers.set(id, providerData);
  }

  /**
   * Enable a provider by ID.
   * @param {string} id
   */
  enableProvider(id) {
    if (!this.enabledProviders.includes(id)) {
      this.enabledProviders.push(id);
    }
  }

  /**
   * Disable a provider by ID.
   * @param {string} id
   */
  disableProvider(id) {
    this.enabledProviders = this.enabledProviders.filter(p => p !== id);
  }

  /**
   * Check if a provider is enabled in plugin settings.
   * @param {string} id
   * @returns {boolean}
   */
  isProviderEnabled(id) {
    return this.enabledProviders.includes(id);
  }

  /**
   * Get all registered providers.
   * 
   * @param {boolean} [onlyActive=false] If true, returns only providers enabled in settings
   * @returns {Array<Object>}
   */
  getProviders(onlyActive = false) {
    this.syncEnabledProviders();
    const all = Array.from(this.providers.values());
    if (!onlyActive) {
      return all;
    }
    return all.filter(provider => this.isProviderEnabled(provider.id));
  }

  /**
   * Get a specific provider by ID.
   * @param {string} id
   * @returns {Object|null}
   */
  getProvider(id) {
    return this.providers.get(id) || null;
  }

  /**
   * Check if a provider is registered.
   * @param {string} id
   * @returns {boolean}
   */
  hasProvider(id) {
    return this.providers.has(id);
  }

  /**
   * Validate a provider for the given language pair and environment.
   * 
   * @param {string} providerId
   * @param {string} [sourceLang='en']
   * @param {string} [targetLang='es']
   * @param {boolean} [bypassCache=false]
   * @returns {Promise<{ available: boolean, reason?: string, noticeType?: string }>}
   */
  async validateProvider(providerId, sourceLang = 'en', targetLang = 'es', bypassCache = false) {
    const provider = this.getProvider(providerId);
    if (!provider) {
      return {
        available: false,
        reason: `Provider "${providerId}" is not registered.`,
        noticeType: 'error'
      };
    }
    if (!this.isProviderEnabled(providerId)) {
      return {
        available: false,
        reason: `Provider "${provider.title}" is disabled in settings.`,
        noticeType: 'warning'
      };
    }

    // Check language support definition
    if (typeof provider.checkAvailability === 'function') {
      const supported = await provider.checkAvailability(sourceLang, targetLang);
      if (supported.available === false) {
        return {
          available: false,
          reason: supported.reason || `Language pair (${sourceLang.toUpperCase()} → ${targetLang.toUpperCase()}) is not supported by ${provider.title}.`,
          reasonHTML: supported.reasonHTML || false,
          reasonTitle: supported.reasonTitle || false,
          actionHtml: supported.actionHtml || false,
          noticeType: 'warning'
        };
      }
    }

    // Run provider-specific availability check (e.g. browser on-device AI check, API key presence)
    try {
      const check = await provider.checkAvailability(sourceLang, targetLang, bypassCache);
      return check || {
        available: true
      };
    } catch (err) {
      return {
        available: false,
        reason: err.message || 'Provider availability check failed.',
        noticeType: 'error'
      };
    }
  }

  /**
   * Create an AbortController for tracking active requests.
   * @returns {AbortController}
   */
  createAbortController() {
    const controller = new AbortController();
    this.activeControllers.add(controller);
    return controller;
  }

  /**
   * Remove an AbortController from active set.
   * @param {AbortController} controller
   */
  releaseAbortController(controller) {
    this.activeControllers.delete(controller);
  }

  /**
   * Abort all active translation requests across providers.
   * @param {string} [reason='Translation cancelled by user']
   */
  abortAll(reason = 'Translation cancelled by user') {
    this.activeControllers.forEach(controller => {
      try {
        if (!controller.signal.aborted) {
          controller.abort(reason);
        }
      } catch (e) {
        console.warn('[TranslateSense] Error aborting controller:', e);
      }
    });
    this.activeControllers.clear();
  }

  /**
   * Check if a string represents an email address, URL, or URL-related file path.
   * @param {string} str
   * @returns {boolean}
   */
  static isEmailOrUrl(str) {
    if (!str || typeof str !== 'string') return false;
    const clean = str.trim();
    if (!clean) return false;

    // 1. Data URIs, e.g. data:image/svg+xml,...
    if (/^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(clean)) {
      return true;
    }

    // 2. Email or mailto:
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) || /^mailto:/i.test(clean)) {
      return true;
    }

    // 3. Protocols and schemes
    if (/^(https?:\/\/|ftp:\/\/|\/\/|www\.|tel:|sms:|javascript:|callto:|whatsapp:)/i.test(clean)) {
      return true;
    }

    // 4. Media or asset paths
    if (/^(\/|\.\/|\.\.\/|#)?[^\s]*\.(png|jpe?g|gif|svg|webp|avif|pdf|mp4|webm|zip|tar|gz|css|js|woff2?|ttf|eot)(\?.*)?$/i.test(clean)) {
      return true;
    }

    // 5. Domain-like strings
    if (/^[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+\/[^\s]*$/i.test(clean)) {
      return true;
    }
    return false;
  }
  isEmailOrUrl(str) {
    return TranslateSenseCore.isEmailOrUrl(str);
  }

  /**
   * Mask inline URLs, email addresses, and protocols with unique protected placeholder tokens.
   * Prevents translation engines from translating or corrupting links embedded inside text.
   * 
   * @param {string} text Plain text segment.
   * @returns {{ maskedText: string, tokenMap: Object }}
   */
  static maskUrlsAndEmails(text) {
    if (!text || typeof text !== 'string') {
      return {
        maskedText: text || '',
        tokenMap: {}
      };
    }
    const tokenMap = {};
    let counter = 0;

    // Match data URIs first, including SVG and other image formats.
    // A data URI ends at whitespace or an HTML delimiter.
    const pattern = /data:image\/[a-z0-9.+-]+(?:;[^,\s<>"'`]*?)?,[^\s<>"'`]*/gi;
    const maskedText = text.replace(new RegExp([/data:image\/[a-z0-9.+-]+(?:;[^,\s<>"'`]*?)?,[^\s<>"'`]*/, /https?:\/\/[^\s<>"'`]+/, /ftp:\/\/[^\s<>"'`]+/, /www\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s<>"'`]*/, /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, /mailto:[^\s<>"'`]+/, /tel:\+?[0-9\s-]{6,}/].map(regex => regex.source).join('|'), 'gi'), match => {
      let cleanMatch = match;
      let trailingPunctuation = '';

      // Preserve sentence punctuation outside the token.
      while (cleanMatch.length > 0 && /[.,;:!?)\]]$/.test(cleanMatch)) {
        trailingPunctuation = cleanMatch.slice(-1) + trailingPunctuation;
        cleanMatch = cleanMatch.slice(0, -1);
      }
      if (!cleanMatch) return match;
      const token = `_@__TS_LINK_${counter++}__@_`;
      tokenMap[token] = cleanMatch;
      return token + trailingPunctuation;
    });
    return {
      maskedText,
      tokenMap
    };
  }
  maskUrlsAndEmails(text) {
    return TranslateSenseCore.maskUrlsAndEmails(text);
  }

  /**
   * Restore masked URL and email placeholder tokens with their original values.
   * 
   * @param {string} text Translated text containing placeholder tokens.
   * @param {Object} tokenMap Map of token => original string.
   * @returns {string} Text with original URLs and emails restored.
   */
  static unmaskUrlsAndEmails(text, tokenMap) {
    if (!text || typeof text !== 'string' || !tokenMap || typeof tokenMap !== 'object') {
      return text || '';
    }
    let restored = text;
    for (const [token, originalVal] of Object.entries(tokenMap)) {
      const match = token.match(/TS_[A-Z]+_\d+/i);
      if (!match) {
        continue;
      }
      const id = match[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const tokenRegex = new RegExp(`[_*\\s]*@\\s*__\\s*${id}\\s*__\\s*@[_*\\s]*`, 'gi');
      restored = restored.replace(tokenRegex, () => String(originalVal));
    }
    return restored;
  }

  /**
   * Helper: Translate text preserving exact HTML tags, structure, and inline URLs/emails.
   * Splits sourceText into HTML tags/comments and plain text segments, masks inline URLs/emails,
   * executes translateCallback on clean text segments, and returns the reconstructed string.
   *
   * @param {string} sourceText Source string potentially containing HTML tags/comments and inline URLs.
   * @param {Function} translateCallback Async or sync callback: async (cleanText: string) => translatedText
   * @returns {Promise<string>} Translated string with exact HTML tags, spacing, and URLs preserved.
   */
  async translateTextPreservingHtml(sourceText, translateCallback) {
    if (!sourceText || typeof sourceText !== 'string' || sourceText.trim() === '') {
      return sourceText || '';
    }
    if (typeof translateCallback !== 'function') {
      return sourceText;
    }

    // Split string into HTML tags/comments and text segments
    // Matches HTML tags (<...>) and comments (<!--...-->)
    const tagRegex = /(<!--[\s\S]*?-->|<[^>]+>)/g;
    const parts = sourceText.split(tagRegex);
    let result = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;

      // If this part is an HTML tag or comment, keep it exactly as-is without adding/closing tags
      if (part.startsWith('<') && part.endsWith('>')) {
        result += part;
      } else {
        // Plain text segment: preserve leading & trailing whitespace
        const leadingMatch = part.match(/^\s*/);
        const trailingMatch = part.match(/\s*$/);
        const leadingSpace = leadingMatch ? leadingMatch[0] : '';
        const trailingSpace = trailingMatch ? trailingMatch[0] : '';
        const cleanText = part.trim();
        if (cleanText) {
          // If the entire text segment is just a URL or email, preserve it directly
          if (TranslateSenseCore.isEmailOrUrl(cleanText)) {
            result += leadingSpace + cleanText + trailingSpace;
          } else {
            // Mask inline URLs and email addresses so they are not altered by translation
            const {
              maskedText,
              tokenMap
            } = TranslateSenseCore.maskUrlsAndEmails(cleanText);
            let translated = await translateCallback(maskedText);
            if (translated !== undefined && translated !== null) {
              translated = TranslateSenseCore.unmaskUrlsAndEmails(translated, tokenMap);
            } else {
              translated = cleanText;
            }
            result += leadingSpace + translated + trailingSpace;
          }
        } else {
          result += part;
        }
      }
    }
    return result;
  }

  /**
   * Execute translation using the registered provider.
   * 
   * @param {string} providerId Provider ID to use
   * @param {Object} params Parameters object { items, sourceLang, targetLang, postId, signal }
   *        items is an array of { hash, content/source, widget_id, field }
   * @param {Function} [onProgressCallback] Callback invoked on translation: callback({ hash, source, translated, status, error })
   * @returns {Promise<Array<Object>>} Resolves with array of { hash, source, translated, status, error }
   */
  async translate(providerId, params, onProgressCallback) {
    const provider = this.getProvider(providerId);
    if (!provider) {
      console.error(`Translation provider "${providerId}" is not registered.`);
    }
    const safeCallback = typeof onProgressCallback === 'function' ? onProgressCallback : () => {};

    // Filter out items that are email addresses or URLs
    const translatableItems = [];
    const skippedResults = [];
    (params.items || []).forEach(item => {
      const text = item.content || item.source || '';
      if (this.isEmailOrUrl(text)) {
        const res = {
          hash: item.hash,
          source: text,
          translated: text,
          status: 'Completed'
        };
        skippedResults.push(res);
        safeCallback(res);
      } else {
        translatableItems.push(item);
      }
    });
    if (translatableItems.length === 0) {
      return skippedResults;
    }
    try {
      const results = await provider.translate({
        ...params,
        items: translatableItems
      }, safeCallback);
      return [...skippedResults, ...(Array.isArray(results) ? results : [])];
    } catch (error) {
      console.error(`[TranslateSense] Error translating with provider "${providerId}":`, error);
    }
  }
  /**
   * Register a Page Editor live updater (e.g. 'gutenberg', 'elementor', 'classic').
   * 
   * @param {string} id Unique editor ID
   * @param {Object} options
   * @param {string} options.title Human readable name
   * @param {Function} options.isActive Function returning boolean if editor is currently loaded
   * @param {Function} options.apply Function (strings, options) to apply translated content live
   */
  registerPageEditor(id, options) {
    if (!id || typeof id !== 'string') {
      console.error('[TranslateSense] Invalid editor ID:', id);
      return;
    }
    if (!options || typeof options.apply !== 'function') {
      console.error(`[TranslateSense] Editor "${id}" must provide an apply() function.`);
      return;
    }
    const editorData = {
      id,
      title: options.title || id,
      isActive: typeof options.isActive === 'function' ? options.isActive : () => false,
      apply: options.apply
    };
    this.pageEditors.set(id, editorData);
  }

  /**
   * Get registered page editor by ID.
   * @param {string} id
   * @returns {Object|null}
   */
  getPageEditor(id) {
    return this.pageEditors.get(id) || null;
  }

  /**
   * Detect and return the currently active page editor.
   * @returns {Object|null}
   */
  getActivePageEditor() {
    for (const editor of this.pageEditors.values()) {
      try {
        if (editor.isActive()) {
          return editor;
        }
      } catch (e) {
        console.warn(`[TranslateSense] Error checking isActive for editor "${editor.id}":`, e);
      }
    }
    return null;
  }

  /**
   * Apply translated strings live to the specified or automatically detected page editor.
   * 
   * @param {string} [editorId] Optional specific editor ID ('gutenberg', 'elementor', 'classic')
   * @param {Object} options
   * @param {Array<Object>} options.strings Array of { field, widget_id, source, translated, hash }
   * @returns {Promise<Object>} Status object { success: boolean, editor: string, count: number }
   */
  async applyToPageEditor(editorId, params = {}) {
    const strings = params.strings || [];
    const options = params.options || {};
    const sourcePageData = params.sourcePageData || options.sourcePageData || null;
    if (!Array.isArray(strings) || strings.length === 0) {
      return {
        success: false,
        message: 'No strings to apply'
      };
    }
    let editor = editorId ? this.getPageEditor(editorId) : null;
    if (!editor || typeof editor.isActive === 'function' && !editor.isActive()) {
      editor = this.getActivePageEditor();
    }
    if (!editor) {
      console.warn('[TranslateSense] No active page editor matched. Falling back to universal meta updater.');
      if (window.TranslateSenseMetaUpdater) {
        window.TranslateSenseMetaUpdater.apply(strings);
      }
      return {
        success: true,
        editor: 'generic',
        count: strings.length
      };
    }
    try {
      await editor.apply(strings, {
        ...options,
        sourcePageData,
        core: this
      });
      return {
        success: true,
        editor: editor.id,
        count: strings.length
      };
    } catch (error) {
      console.error(`[TranslateSense] Error applying translation to editor "${editor.id}":`, error);
    }
  }

  /**
   * Fetch comprehensive page content from REST endpoint (/get-page-content).
   * Returns post_title, post_content, post_excerpt, meta fields, etc.
   * 
   * @param {number} postId Post ID to retrieve
   * @param {Array<string>|string} [fields=[]] Optional specific fields filter
   * @returns {Promise<Object>}
   */
  async getPageContent(postId, fields = []) {
    const config = window.TranslateSenseEditorData || window.TranslateSenseBulkData || {};
    const restUrl = config.restUrl || '/wp-json/translatesense/v1/';
    const nonce = config.nonce || '';
    const id = postId || config.postId || 0;
    if (!id) {
      console.error('Missing post ID for getPageContent');
    }
    this.pageContentCache = this.pageContentCache || new Map();
    const fieldsStr = Array.isArray(fields) ? fields.join(',') : fields || '';
    const cacheKey = `${id}_${fieldsStr}`;
    if (this.pageContentCache.has(cacheKey)) {
      return this.pageContentCache.get(cacheKey);
    }
    let url = restUrl + 'get-page-content?post_id=' + encodeURIComponent(id);
    if (fieldsStr) {
      url += '&fields=' + encodeURIComponent(fieldsStr);
    }
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-WP-Nonce': nonce
      }
    });
    const data = await response.json();
    this.pageContentCache.set(cacheKey, data);
    return data;
  }

  /**
   * Fetch block configuration rules parsed from editor-xml-config REST endpoint.
   */
  async getEditorConfig(editor = null, cache) {
    if (!editor) {
      return;
    }
    if (cache) {
      return cache;
    }
    const config = window.TranslateSenseEditorData || window.TranslateSenseBulkData || {};
    const restUrl = config.restUrl || '/wp-json/translatesense/v1/';
    const nonce = config.nonce || '';
    try {
      const response = await fetch(restUrl + 'editor-xml-config?editor=' + editor, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': nonce
        }
      });
      const data = await response.json();
      if (data && data.rules) {
        cache = data.rules;
        return cache;
      }
    } catch (err) {
      console.warn('[TranslateSense] Could not fetch /editor-xml-config?editor=' + editor + ':', err);
    }
    return {};
  }
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TranslateSenseCore);

/***/ },

/***/ "./src/services/core/coreService.js"
/*!******************************************!*\
  !*** ./src/services/core/coreService.js ***!
  \******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getCoreInstance: () => (/* binding */ getCoreInstance),
/* harmony export */   resetCoreInstance: () => (/* binding */ resetCoreInstance)
/* harmony export */ });
/* harmony import */ var _coreInstance__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./coreInstance */ "./src/services/core/coreInstance.js");
/**
 * Adapter Service for TranslateSenseCore
 *
 * Wraps window.TranslateSenseCore so components do not access globals directly.
 */

let coreInstance = null;

/**
 * Returns the singleton TranslateSenseCore instance
 * @returns {Object|null}
 */
function getCoreInstance() {
  if (coreInstance) {
    return coreInstance;
  }
  coreInstance = new _coreInstance__WEBPACK_IMPORTED_MODULE_0__["default"]();
  return coreInstance;
}

/**
 * Reset core instance (e.g. for testing)
 */
function resetCoreInstance() {
  coreInstance = null;
}

/***/ },

/***/ "./src/services/core/translationService.js"
/*!*************************************************!*\
  !*** ./src/services/core/translationService.js ***!
  \*************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   extractStrings: () => (/* binding */ extractStrings),
/* harmony export */   markTranslated: () => (/* binding */ markTranslated),
/* harmony export */   translateBatch: () => (/* binding */ translateBatch),
/* harmony export */   translatePost: () => (/* binding */ translatePost)
/* harmony export */ });
/* harmony import */ var _api_apiClient__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../api/apiClient */ "./src/services/api/apiClient.js");
/* harmony import */ var _api_endpoints__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../api/endpoints */ "./src/services/api/endpoints.js");
/**
 * Server-side Translation Service
 */




/**
 * Extract translatable strings from post
 * @param {number} postId
 * @param {string} [builder]
 * @param {string} [targetLang]
 * @returns {Promise<{ success: boolean, strings: Array }>}
 */
async function extractStrings(postId, builder = '', targetLang = '') {
  return await (0,_api_apiClient__WEBPACK_IMPORTED_MODULE_0__.apiRequest)(_api_endpoints__WEBPACK_IMPORTED_MODULE_1__.ENDPOINTS.EXTRACT_STRINGS, {
    method: 'POST',
    data: {
      post_id: Number(postId),
      builder,
      target_lang: targetLang
    }
  });
}

/**
 * Translate batch of items on server
 * @param {Object} payload
 * @returns {Promise<{ success: boolean, translations: Array }>}
 */
async function translateBatch(payload) {
  return await (0,_api_apiClient__WEBPACK_IMPORTED_MODULE_0__.apiRequest)(_api_endpoints__WEBPACK_IMPORTED_MODULE_1__.ENDPOINTS.TRANSLATE_BATCH, {
    method: 'POST',
    data: payload
  });
}

/**
 * Create or save translated post on server
 * @param {Object} payload
 * @returns {Promise<{ success: boolean, target_post_id: number, edit_url: string, translated_title: string }>}
 */
async function translatePost(payload) {
  return await (0,_api_apiClient__WEBPACK_IMPORTED_MODULE_0__.apiRequest)(_api_endpoints__WEBPACK_IMPORTED_MODULE_1__.ENDPOINTS.TRANSLATE_POST, {
    method: 'POST',
    data: payload
  });
}

/**
 * Mark post as translated and save stats
 * @param {Object} payload
 * @returns {Promise<{ success: boolean }>}
 */
async function markTranslated(payload) {
  return await (0,_api_apiClient__WEBPACK_IMPORTED_MODULE_0__.apiRequest)(_api_endpoints__WEBPACK_IMPORTED_MODULE_1__.ENDPOINTS.MARK_TRANSLATED, {
    method: 'POST',
    data: payload
  });
}

/***/ },

/***/ "./src/services/providers/providerRegistry.js"
/*!****************************************************!*\
  !*** ./src/services/providers/providerRegistry.js ***!
  \****************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getRegisteredProviders: () => (/* binding */ getRegisteredProviders)
/* harmony export */ });
/* harmony import */ var _core_coreService__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../core/coreService */ "./src/services/core/coreService.js");
/**
 * Provider Registry Adapter
 */



/**
 * Get raw registered providers from Core or window registry
 * @param {boolean} [enabledOnly=true]
 * @returns {Array<Object>}
 */
function getRegisteredProviders(enabledOnly = true) {
  const core = (0,_core_coreService__WEBPACK_IMPORTED_MODULE_0__.getCoreInstance)();
  let list = core.getProviders(enabledOnly);
  if (list && list.length > 0) {
    return list;
  }
  return [];
}

/***/ },

/***/ "./src/services/providers/providerService.js"
/*!***************************************************!*\
  !*** ./src/services/providers/providerService.js ***!
  \***************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getEvaluatedProviders: () => (/* binding */ getEvaluatedProviders),
/* harmony export */   getProviderMeta: () => (/* binding */ getProviderMeta)
/* harmony export */ });
/* harmony import */ var _providerRegistry__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./providerRegistry */ "./src/services/providers/providerRegistry.js");
/**
 * Provider Service
 * Evaluates provider availability, status badges, and options
 */



/**
 * Get plugin localized configuration
 */
function getConfig() {
  if (typeof window === 'undefined') return {};
  return window.TranslateSenseEditorData || window.TranslateSenseBulkData || window.TranslateSenseData || {};
}

/**
 * Check single provider status metadata
 */
function getProviderMeta(id, config = getConfig()) {
  const enabledProviders = config.enabledProviders || {};
  const settingsUrl = config.settingsUrl || 'admin.php?page=translatesense&tab=settings';
  const connectorsUrl = config.connectorsUrl || 'options-connectors.php';
  if (enabledProviders && typeof enabledProviders === 'object' && !Array.isArray(enabledProviders) && enabledProviders[id]) {
    const meta = enabledProviders[id];
    const isConn = meta.isConnected !== false;
    const isCore = Boolean(meta.connectors);
    const isInstall = meta.isProviderInstall !== undefined ? Boolean(meta.isProviderInstall) : true;
    const isActive = meta.isProviderActive !== undefined ? Boolean(meta.isProviderActive) : true;
    return {
      isConnected: isConn,
      connectors: isCore,
      isProviderInstall: isInstall,
      isProviderActive: isActive,
      targetUrl: isCore ? connectorsUrl : settingsUrl
    };
  }
  const isMissing = id === 'openai' ? !config.hasOpenAiKey : id === 'gemini' ? !config.hasGeminiKey : false;
  return {
    isConnected: !isMissing,
    connectors: false,
    isProviderInstall: false,
    isProviderActive: false,
    targetUrl: settingsUrl
  };
}

/**
 * Evaluates full provider list with support checks for language pair
 *
 * @param {string} [sourceLang='en']
 * @param {string} [targetLang='es']
 * @returns {Promise<Array<Object>>}
 */
async function getEvaluatedProviders(sourceLang = 'en', targetLang = 'es') {
  const config = getConfig();
  let providers = (0,_providerRegistry__WEBPACK_IMPORTED_MODULE_0__.getRegisteredProviders)(true);
  if (providers.length === 0) {
    providers = (0,_providerRegistry__WEBPACK_IMPORTED_MODULE_0__.getRegisteredProviders)(false);
  }

  // Deep clone to avoid mutating registry
  const list = providers.map(p => ({
    ...p
  }));
  for (const p of list) {
    const isFrontend = p.id === 'chrome_ai' || p.id === 'chrome_local_ai';
    const statusMeta = getProviderMeta(p.id, config);
    p.statusMeta = statusMeta;
    if (isFrontend) {
      if (typeof p.checkAvailability === 'function') {
        try {
          p.isSupported = await p.checkAvailability(sourceLang, targetLang, true);
        } catch (e) {
          p.isSupported = {
            available: false,
            reason: e.message
          };
        }
      }
      p.isAvailable = !(p.isSupported && p.isSupported.available === false);
      p.badgeType = p.isAvailable ? 'on-device' : 'error';
      p.badgeText = p.isAvailable ? 'On-device' : 'View Error';
    } else if (statusMeta.connectors && statusMeta.isProviderInstall) {
      if (!statusMeta.isProviderActive) {
        p.isAvailable = false;
        p.badgeType = 'action';
        p.badgeText = 'Activate Provider';
        p.actionUrl = statusMeta.targetUrl;
      } else if (!statusMeta.isConnected) {
        p.isAvailable = false;
        p.badgeType = 'action';
        p.badgeText = 'API key required';
        p.actionUrl = statusMeta.targetUrl;
      } else {
        p.isAvailable = true;
        p.badgeType = 'ready';
        p.badgeText = 'Available';
      }
    } else {
      // Direct API
      if (!statusMeta.isConnected) {
        p.isAvailable = false;
        p.badgeType = 'action';
        p.badgeText = 'API key required';
        p.actionUrl = statusMeta.targetUrl;
      } else {
        p.isAvailable = true;
        p.badgeType = 'ready';
        p.badgeText = 'Available';
      }
    }
  }
  return list;
}

/***/ },

/***/ "./src/utils/formatting.js"
/*!*********************************!*\
  !*** ./src/utils/formatting.js ***!
  \*********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   formatDuration: () => (/* binding */ formatDuration),
/* harmony export */   formatMs: () => (/* binding */ formatMs),
/* harmony export */   formatNumber: () => (/* binding */ formatNumber)
/* harmony export */ });
/**
 * Formatting utilities for TranslateSense
 */

/**
 * Format numbers with compact K/M notation or locale string
 * @param {number} num
 * @returns {string}
 */
function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  const n = Number(num);
  if (n >= 1000000) {
    return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (n >= 1000) {
    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return n.toLocaleString();
}

/**
 * Format seconds into mm:ss or Xm Ys
 * @param {number} seconds
 * @param {boolean} humanReadable
 * @returns {string}
 */
function formatDuration(seconds, humanReadable = false) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (humanReadable) {
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Format elapsed milliseconds into human time
 * @param {number} ms
 * @returns {string}
 */
function formatMs(ms) {
  if (ms >= 60000) {
    const m = Math.floor(ms / 60000);
    const s = Math.round(ms % 60000 / 1000);
    return `${m}m ${s}s`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

/***/ },

/***/ "./src/utils/html.js"
/*!***************************!*\
  !*** ./src/utils/html.js ***!
  \***************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   cleanContentEditable: () => (/* binding */ cleanContentEditable),
/* harmony export */   escapeHtml: () => (/* binding */ escapeHtml),
/* harmony export */   stripHtml: () => (/* binding */ stripHtml)
/* harmony export */ });
/**
 * HTML and String Sanitization utilities
 */

/**
 * Escapes HTML characters for safe DOM insertion
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/**
 * Strips HTML tags from text
 * @param {string} html
 * @returns {string}
 */
function stripHtml(html) {
  if (!html) return '';
  return String(html).replace(/<[^>]*>/g, '');
}

/**
 * Trims linebreaks at start/end of contenteditable edits
 * @param {string} str
 * @returns {string}
 */
function cleanContentEditable(str) {
  if (!str) return '';
  return String(str).replace(/^\r?\n+|\r?\n+$/g, '');
}

/***/ },

/***/ "./src/utils/language.js"
/*!*******************************!*\
  !*** ./src/utils/language.js ***!
  \*******************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getLanguageDisplay: () => (/* binding */ getLanguageDisplay),
/* harmony export */   getLanguageFlag: () => (/* binding */ getLanguageFlag)
/* harmony export */ });
/**
 * Language utilities for TranslateSense
 */

/**
 * Get language display name with optional uppercase code
 * @param {string|Object} langInput
 * @param {Array|Object} allLanguages
 * @returns {string}
 */
function getLanguageDisplay(langInput, allLanguages = []) {
  if (!langInput) return '';
  const langsList = Array.isArray(allLanguages) ? allLanguages : allLanguages && typeof allLanguages === 'object' ? Object.values(allLanguages) : [];
  if (typeof langInput === 'object' && langInput !== null) {
    const code = (langInput.code || langInput.slug || '').toUpperCase();
    const name = langInput.name || code;
    return `${name} (${code})`;
  }
  const slug = String(langInput).toLowerCase();
  const found = langsList.find(l => l.slug && l.slug.toLowerCase() === slug || l.code && l.code.toLowerCase() === slug);
  if (found) {
    const code = (found.code || found.slug || slug).toUpperCase();
    return `${found.name || code} (${code})`;
  }
  return slug.toUpperCase();
}

/**
 * Get language flag URL or fallback code
 * @param {string|Object} langInput
 * @param {Array|Object} allLanguages
 * @returns {{ hasFlag: boolean, flagUrl: string, code: string, name: string }}
 */
function getLanguageFlag(langInput, allLanguages = []) {
  const langsList = Array.isArray(allLanguages) ? allLanguages : allLanguages && typeof allLanguages === 'object' ? Object.values(allLanguages) : [];
  let code = '';
  let flag = '';
  let name = '';
  if (typeof langInput === 'object' && langInput !== null) {
    code = (langInput.code || langInput.slug || '').toUpperCase();
    flag = langInput.flag || '';
    name = langInput.name || code;
  } else {
    const slug = String(langInput).toLowerCase();
    const found = langsList.find(l => l.slug && l.slug.toLowerCase() === slug || l.code && l.code.toLowerCase() === slug);
    if (found) {
      code = (found.code || found.slug || slug).toUpperCase();
      flag = found.flag || '';
      name = found.name || code;
    } else {
      code = slug.toUpperCase();
      name = code;
    }
  }
  return {
    hasFlag: Boolean(flag),
    flagUrl: flag,
    code,
    name
  };
}

/***/ },

/***/ "./src/utils/validation.js"
/*!*********************************!*\
  !*** ./src/utils/validation.js ***!
  \*********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isEmailOrUrl: () => (/* binding */ isEmailOrUrl)
/* harmony export */ });
/**
 * Validation utilities
 */

/**
 * Check if a string represents an email address, URL, or URL-related file path.
 * Used to avoid sending URLs or assets to AI for translation.
 * @param {string} str
 * @returns {boolean}
 */
function isEmailOrUrl(str) {
  if (!str || typeof str !== 'string') return false;
  const clean = str.trim();
  if (!clean) return false;

  // 1. Email or mailto:
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) || /^mailto:/i.test(clean)) return true;

  // 2. Protocols and schemes
  if (/^(https?:\/\/|ftp:\/\/|\/\/|www\.|tel:|sms:|javascript:|callto:|whatsapp:)/i.test(clean)) return true;

  // 3. Media or asset paths
  if (/^(\/|\.\/|\.\.\/|#)?[^\s]*\.(png|jpe?g|gif|svg|webp|avif|pdf|mp4|webm|zip|tar|gz|css|js|woff2?|ttf|eot)(\?.*)?$/i.test(clean)) {
    return true;
  }

  // 4. Domain-like strings
  if (/^[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+\/[^\s]*$/i.test(clean)) return true;
  return false;
}

/***/ },

/***/ "./src/styles/bulk.scss"
/*!******************************!*\
  !*** ./src/styles/bulk.scss ***!
  \******************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
// extracted by mini-css-extract-plugin


/***/ },

/***/ "react"
/*!************************!*\
  !*** external "React" ***!
  \************************/
(module) {

module.exports = window["React"];

/***/ },

/***/ "@wordpress/element"
/*!*********************************!*\
  !*** external ["wp","element"] ***!
  \*********************************/
(module) {

module.exports = window["wp"]["element"];

/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	const __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		const cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		const module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		if (!(moduleId in __webpack_modules__)) {
/******/ 			delete __webpack_module_cache__[moduleId];
/******/ 			const e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = (module) => {
/******/ 		const getter = module && module.__esModule ?
/******/ 			() => (module['default']) :
/******/ 			() => (module);
/******/ 		__webpack_require__.d(getter, { a: getter });
/******/ 		return getter;
/******/ 	};
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	// define getter/value functions for harmony exports
/******/ 	__webpack_require__.d = (exports, definition) => {
/******/ 		for(var key in definition) {
/******/ 			if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 				Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 			}
/******/ 		}
/******/ 	};
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	__webpack_require__.o = (obj, prop) => (Object.hasOwn(obj, prop));
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = (exports) => {
/******/ 		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/ 	
/************************************************************************/
let __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!****************************!*\
  !*** ./src/bulk/index.jsx ***!
  \****************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _BulkApp__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./BulkApp */ "./src/bulk/BulkApp.jsx");
/* harmony import */ var _styles_bulk_scss__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../styles/bulk.scss */ "./src/styles/bulk.scss");

/**
 * Bulk Translation Entry Point
 */




function initBulk() {
  let rootEl = document.getElementById('translatesense-bulk-modal-root');
  if (!rootEl) {
    rootEl = document.createElement('div');
    rootEl.id = 'translatesense-bulk-modal-root';
    document.body.appendChild(rootEl);
  }
  if (rootEl && !rootEl._tsReactRoot) {
    const root = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.createRoot)(rootEl);
    rootEl._tsReactRoot = root;
    root.render((0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_BulkApp__WEBPACK_IMPORTED_MODULE_2__.BulkApp, null));
  }
}
(function (window, document) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBulk);
  } else {
    initBulk();
  }
})(window, document);
})();

/******/ })()
;
//# sourceMappingURL=index.js.map