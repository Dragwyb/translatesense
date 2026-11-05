/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

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

/***/ "./src/components/SearchInput/SearchInput.jsx"
/*!****************************************************!*\
  !*** ./src/components/SearchInput/SearchInput.jsx ***!
  \****************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SearchInput: () => (/* binding */ SearchInput)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);

/**
 * Reusable SearchInput Component
 */

function SearchInput({
  value = '',
  onChange,
  placeholder = 'Search...',
  disabled = false,
  className = '',
  autoFocus = false,
  id = '',
  name = ''
}) {
  const handleClear = () => {
    if (onChange) {
      onChange({
        target: {
          value: ''
        }
      });
    }
  };
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: `ts-search-input-wrap ${className}`
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-search-icon",
    "aria-hidden": "true"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("circle", {
    cx: "11",
    cy: "11",
    r: "8"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("line", {
    x1: "21",
    y1: "21",
    x2: "16.65",
    y2: "16.65"
  }))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("input", {
    id: id || undefined,
    name: name || undefined,
    type: "text",
    className: "ts-search-input-field",
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    disabled: disabled,
    autoComplete: "off",
    autoFocus: autoFocus
  }), value && !disabled && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-search-clear-btn",
    onClick: handleClear,
    title: "Clear search",
    "aria-label": "Clear search"
  }, "\xD7"));
}

/***/ },

/***/ "./src/components/SearchInput/index.js"
/*!*********************************************!*\
  !*** ./src/components/SearchInput/index.js ***!
  \*********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SearchInput: () => (/* reexport safe */ _SearchInput__WEBPACK_IMPORTED_MODULE_0__.SearchInput)
/* harmony export */ });
/* harmony import */ var _SearchInput__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./SearchInput */ "./src/components/SearchInput/SearchInput.jsx");


/***/ },

/***/ "./src/page/PageApp.jsx"
/*!******************************!*\
  !*** ./src/page/PageApp.jsx ***!
  \******************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   PageApp: () => (/* binding */ PageApp)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _hooks_usePageTranslation__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./hooks/usePageTranslation */ "./src/page/hooks/usePageTranslation.js");
/* harmony import */ var _hooks_usePageEditor__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./hooks/usePageEditor */ "./src/page/hooks/usePageEditor.js");
/* harmony import */ var _components_SourcePrompt__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./components/SourcePrompt */ "./src/page/components/SourcePrompt.jsx");
/* harmony import */ var _components_ProviderModal__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./components/ProviderModal */ "./src/page/components/ProviderModal.jsx");
/* harmony import */ var _components_ReviewModal__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./components/ReviewModal */ "./src/page/components/ReviewModal.jsx");
/* harmony import */ var _components_ErrorModal__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../components/ErrorModal */ "./src/components/ErrorModal/index.js");

/**
 * PageApp Component
 * Root component for Universal Page Editor Application (Gutenberg, Elementor, Classic)
 * Coordinates modals inside a single root ts-modal-overlay when any modal is open.
 */








function PageApp() {
  const config = typeof window !== 'undefined' && window.TranslateSenseEditorData || {};
  const translation = (0,_hooks_usePageTranslation__WEBPACK_IMPORTED_MODULE_2__.usePageTranslation)(config);
  const handleOpenProvider = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
    translation.loadProviders();
    translation.setIsProviderModalOpen(true);
  }, [translation]);
  const handleShowInitialPrompt = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
    if (translation.isProviderModalOpen || translation.isReviewModalOpen || translation.progress?.isOpen) {
      return;
    }
    if (null === translation.isSourcePromptOpen) {
      translation.setIsSourcePromptOpen(true);
    }
  }, [translation]);
  const {
    markButtonsApplied
  } = (0,_hooks_usePageEditor__WEBPACK_IMPORTED_MODULE_3__.usePageEditor)({
    onOpenProviderModal: handleOpenProvider,
    onShowInitialPrompt: handleShowInitialPrompt,
    translation
  });
  const handleStartTranslation = async () => {
    translation.setIsProviderModalOpen(false);
    await translation.extractAndTranslate(translation.selectedProvider);
  };
  const handleApplyToPage = async () => {
    const res = await translation.applyTranslationsToPage();
    markButtonsApplied();
    return res;
  };
  const handleUpdateTranslation = (index, newVal) => {
    translation.setStrings(prev => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = {
          ...updated[index],
          translated: newVal,
          status: 'Custom'
        };
      }
      return updated;
    });
  };
  const handleResetTranslation = index => {
    translation.setStrings(prev => {
      const updated = [...prev];
      if (updated[index]) {
        const provVal = updated[index].providerTranslated || '';
        updated[index] = {
          ...updated[index],
          translated: provVal,
          status: 'Completed'
        };
      }
      return updated;
    });
  };
  const selectedProviderObj = translation.providers.find(p => p.id === translation.selectedProvider);
  const providerTitle = selectedProviderObj?.title || 'AI Provider';
  const allLanguages = Object.values(config.languages || {});
  const isAnyModalOpen = Boolean(translation.errorModal && translation.errorModal.isOpen || translation.progress && translation.progress.isOpen || translation.isReviewModalOpen || translation.isProviderModalOpen || translation.isSourcePromptOpen);
  const handleOverlayClick = e => {
    if (e.target !== e.currentTarget) return;
    if (translation.errorModal?.isOpen) {
      translation.setErrorModal({
        isOpen: false,
        title: '',
        message: '',
        errorObj: null,
        reasonHTML: ''
      });
      return;
    }
    if (translation.progress?.isOpen) {
      return; // Do not close while translation is actively processing
    }
    if (translation.isReviewModalOpen) {
      translation.setIsReviewModalOpen(false);
      return;
    }
    if (translation.isProviderModalOpen) {
      translation.setIsProviderModalOpen(false);
      return;
    }
    if (translation.isSourcePromptOpen) {
      translation.setIsSourcePromptOpen(false);
      return;
    }
  };
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "translatesense-page-app"
  }, isAnyModalOpen && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-modal-overlay",
    onClick: handleOverlayClick,
    role: "presentation"
  }, translation.errorModal?.isOpen ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_ErrorModal__WEBPACK_IMPORTED_MODULE_7__.ErrorModal, {
    isOpen: true,
    title: translation.errorModal.title,
    message: translation.errorModal.message,
    reasonHTML: translation.errorModal.reasonHTML,
    icon: translation.errorModal.icon,
    onClose: () => translation.setErrorModal({
      isOpen: false,
      title: '',
      message: '',
      errorObj: null,
      reasonHTML: ''
    })
  }) : translation.isReviewModalOpen ? /* 3. String Review Modal */
  (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_ReviewModal__WEBPACK_IMPORTED_MODULE_6__.ReviewModal, {
    isOpen: true,
    onClose: () => translation.setIsReviewModalOpen(false),
    strings: translation.strings,
    translationStats: translation.translationStats,
    onUpdateTranslation: handleUpdateTranslation,
    onResetTranslation: handleResetTranslation,
    isExtracting: translation.progress.isExtracting,
    progressIsOpen: translation.progress?.isOpen,
    progressPercent: translation.progress.percent,
    progressStatus: translation.progress.status,
    progressSubText: translation.progress.subText,
    progressTargetLang: translation.targetLang,
    progressLanguages: allLanguages,
    progressProviderTitle: providerTitle,
    onReTranslate: () => translation.extractAndTranslate(translation.selectedProvider, true),
    onApply: handleApplyToPage
  })) : translation.isProviderModalOpen ? /* 4. Provider Selection Modal */
  (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_ProviderModal__WEBPACK_IMPORTED_MODULE_5__.ProviderModal, {
    isOpen: true,
    onClose: () => translation.setIsProviderModalOpen(false),
    providers: translation.providers,
    selectedProvider: translation.selectedProvider,
    onSelectProvider: translation.setSelectedProvider,
    onStartTranslation: handleStartTranslation,
    onViewError: p => translation.setErrorModal({
      isOpen: true,
      title: `${p.title} Notice`,
      message: p.desc,
      reasonHTML: p.isSupported?.reasonHTML || p.isSupported?.reason,
      icon: p.logo
    })
  }) : translation.isSourcePromptOpen ? /* 5. Initial Page Load Guidance Modal */
  (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_SourcePrompt__WEBPACK_IMPORTED_MODULE_4__.SourcePrompt, {
    isOpen: true,
    onClose: () => translation.setIsSourcePromptOpen(false),
    onConfirm: () => {
      translation.setIsSourcePromptOpen(false);
      handleOpenProvider();
    },
    sourceLanguage: translation.sourceLang,
    targetLanguage: translation.targetLang,
    languages: allLanguages
  }) : null));
}

/***/ },

/***/ "./src/page/components/ProviderModal.jsx"
/*!***********************************************!*\
  !*** ./src/page/components/ProviderModal.jsx ***!
  \***********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ProviderModal: () => (/* binding */ ProviderModal)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _components_Modal__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../components/Modal */ "./src/components/Modal/index.js");
/* harmony import */ var _components_ProviderCard__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../components/ProviderCard */ "./src/components/ProviderCard/index.js");
/* harmony import */ var _components_Button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../components/Button */ "./src/components/Button/index.js");

/**
 * ProviderModal Component (Page Editor)
 */




function ProviderModal({
  isOpen,
  onClose,
  providers = [],
  selectedProvider = '',
  onSelectProvider,
  onStartTranslation,
  onViewError
}) {
  if (!isOpen) return null;
  const hasAvailable = providers.some(p => p.isAvailable);
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Modal__WEBPACK_IMPORTED_MODULE_1__.Modal, {
    isOpen: isOpen,
    onClose: onClose,
    className: "ts-provider-modal-container",
    header: (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Modal__WEBPACK_IMPORTED_MODULE_1__.ModalHeader, {
      title: "Choose Translation Provider",
      subtitle: "Choose a translation provider",
      onClose: onClose
    }),
    footer: (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Modal__WEBPACK_IMPORTED_MODULE_1__.ModalFooter, {
      align: "right"
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Button__WEBPACK_IMPORTED_MODULE_3__.Button, {
      variant: "secondary",
      onClick: onClose
    }, "Cancel"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Button__WEBPACK_IMPORTED_MODULE_3__.Button, {
      variant: hasAvailable ? 'primary' : 'disabled',
      disabled: !hasAvailable || !selectedProvider,
      onClick: onStartTranslation
    }, "Start Translation"))
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-provider-list"
  }, providers.map(p => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_ProviderCard__WEBPACK_IMPORTED_MODULE_2__.ProviderCard, {
    key: p.id,
    provider: p,
    isSelected: selectedProvider === p.id,
    onSelect: onSelectProvider,
    onViewError: onViewError
  }))));
}

/***/ },

/***/ "./src/page/components/ReviewModal.jsx"
/*!*********************************************!*\
  !*** ./src/page/components/ReviewModal.jsx ***!
  \*********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ReviewModal: () => (/* binding */ ReviewModal)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _components_Modal__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../components/Modal */ "./src/components/Modal/index.js");
/* harmony import */ var _components_Button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../components/Button */ "./src/components/Button/index.js");
/* harmony import */ var _components_SearchInput__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../components/SearchInput */ "./src/components/SearchInput/index.js");
/* harmony import */ var _TranslationStats__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./TranslationStats */ "./src/page/components/TranslationStats.jsx");
/* harmony import */ var _ReviewTable__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./ReviewTable */ "./src/page/components/ReviewTable.jsx");
/* harmony import */ var _TranslationProgress__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./TranslationProgress */ "./src/page/components/TranslationProgress.jsx");

/**
 * ReviewModal Component
 * Review and edit translations before applying to the page.
 */








function ReviewModal({
  isOpen,
  onClose,
  strings = [],
  translationStats = {},
  onUpdateTranslation,
  onResetTranslation,
  isExtracting,
  progressIsOpen,
  progressPercent,
  progressStatus,
  progressSubText,
  progressTargetLang,
  progressLanguages,
  progressProviderTitle,
  onReTranslate,
  onApply
}) {
  const [search, setSearch] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)('');
  const [applying, setApplying] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
  if (!isOpen) return null;
  const handleApplyClick = async () => {
    setApplying(true);
    try {
      if (onApply) {
        await onApply();
      }
    } finally {
      setApplying(false);
    }
  };
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Modal__WEBPACK_IMPORTED_MODULE_2__.Modal, {
    isOpen: isOpen,
    onClose: onClose,
    className: "ts-review-container",
    header: (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Modal__WEBPACK_IMPORTED_MODULE_2__.ModalHeader, {
      title: "Review Translations",
      subtitle: "Review and edit translations before applying to the page.",
      onClose: onClose,
      closeId: "ts-review-modal-close"
    }),
    footer: (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Modal__WEBPACK_IMPORTED_MODULE_2__.ModalFooter, {
      align: "space-between",
      customHtml: (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
        className: "ts-footer-string-counter"
      }, strings.length, " of ", strings.length, " strings")
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
      style: {
        display: 'flex',
        gap: '8px'
      }
    }, onReTranslate && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Button__WEBPACK_IMPORTED_MODULE_3__.Button, {
      variant: "secondary",
      onClick: onReTranslate,
      disabled: applying
    }, "Re-Translate All"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Button__WEBPACK_IMPORTED_MODULE_3__.Button, {
      variant: "secondary",
      onClick: onClose
    }, "Cancel"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Button__WEBPACK_IMPORTED_MODULE_3__.Button, {
      variant: "primary",
      onClick: handleApplyClick,
      loading: applying,
      disabled: applying || strings.length === 0
    }, "Apply to Page")))
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-review-body-wrap"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-review-toolbar"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_SearchInput__WEBPACK_IMPORTED_MODULE_4__.SearchInput, {
    value: search,
    onChange: e => setSearch(e.target.value),
    placeholder: "Search source or translation..."
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_TranslationStats__WEBPACK_IMPORTED_MODULE_5__.TranslationStats, {
    stats: translationStats
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_ReviewTable__WEBPACK_IMPORTED_MODULE_6__.ReviewTable, {
    strings: strings,
    filterQuery: search,
    isExtracting: isExtracting,
    onUpdateTranslation: onUpdateTranslation,
    onResetTranslation: onResetTranslation
  })), progressIsOpen && /* 2. Translation Progress Modal (Coffee Cup Visual) */
  (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-review-progress-overlay"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_TranslationProgress__WEBPACK_IMPORTED_MODULE_7__.TranslationProgress, {
    isOpen: true,
    percent: progressPercent,
    status: progressStatus,
    subText: progressSubText,
    targetLang: progressTargetLang,
    languages: progressLanguages,
    providerTitle: progressProviderTitle
  })));
}

/***/ },

/***/ "./src/page/components/ReviewRow.jsx"
/*!*******************************************!*\
  !*** ./src/page/components/ReviewRow.jsx ***!
  \*******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ReviewRow: () => (/* binding */ ReviewRow)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _utils_html__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../utils/html */ "./src/utils/html.js");

/**
 * ReviewRow Component
 * Single translatable string comparison & editing row
 */



function ReviewRow({
  item,
  index,
  onUpdateTranslation,
  onResetTranslation
}) {
  const textRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useRef)(null);
  const sourceVal = item.value || item.source || '';
  const transVal = item.translated || '';
  const providerVal = item.providerTranslated !== undefined ? item.providerTranslated : transVal;
  const hasChanged = Boolean(providerVal && transVal !== providerVal);

  // Synchronize DOM text with transVal without disturbing caret if user is actively typing
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useLayoutEffect)(() => {
    if (textRef.current) {
      const currentDomVal = (0,_utils_html__WEBPACK_IMPORTED_MODULE_2__.cleanContentEditable)(textRef.current.innerText || '');
      const isFocused = document.activeElement === textRef.current;
      if (currentDomVal !== transVal && !isFocused) {
        textRef.current.innerText = transVal;
      }
    }
  }, [transVal]);
  const handleInput = e => {
    const val = (0,_utils_html__WEBPACK_IMPORTED_MODULE_2__.cleanContentEditable)(e.currentTarget.innerText || '');
    if (onUpdateTranslation) {
      onUpdateTranslation(index, val);
    }
  };
  const handleBlur = e => {
    const val = (0,_utils_html__WEBPACK_IMPORTED_MODULE_2__.cleanContentEditable)(e.currentTarget.innerText || '');
    if (val !== transVal && onUpdateTranslation) {
      onUpdateTranslation(index, val);
    }
  };
  const handlePaste = e => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      handleInput(e);
    }
  };
  const handleFocusClick = () => {
    if (textRef.current) {
      textRef.current.focus();
      const range = document.createRange();
      range.selectNodeContents(textRef.current);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };
  const handleReset = e => {
    e.stopPropagation();
    if (onResetTranslation) {
      onResetTranslation(index);
    }
    if (textRef.current) {
      textRef.current.innerText = providerVal;
    }
  };
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("tr", {
    "data-idx": index
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("td", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-source-text"
  }, sourceVal), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-widget-tag"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-tag-symbol"
  }, "<>"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", null, item.name || 'block'))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("td", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-trans-cell-wrap"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-trans-box"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    ref: textRef,
    className: "ts-trans-text",
    contentEditable: "plaintext-only",
    suppressContentEditableWarning: true,
    onInput: handleInput,
    onBlur: handleBlur,
    onPaste: handlePaste,
    "data-placeholder": "Enter translation..."
  }), hasChanged && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-trans-reset-btn",
    onClick: handleReset,
    title: "Reset to provider translation"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("path", {
    d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("path", {
    d: "M3 3v5h5"
  })))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("button", {
    type: "button",
    className: "ts-row-edit-btn",
    onClick: handleFocusClick,
    title: "Edit translation"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("path", {
    d: "M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"
  }))))));
}

/***/ },

/***/ "./src/page/components/ReviewTable.jsx"
/*!*********************************************!*\
  !*** ./src/page/components/ReviewTable.jsx ***!
  \*********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ReviewTable: () => (/* binding */ ReviewTable)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _ReviewRow__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./ReviewRow */ "./src/page/components/ReviewRow.jsx");

/**
 * ReviewTable Component
 */


function ReviewTable({
  strings = [],
  filterQuery = '',
  isExtracting = false,
  onUpdateTranslation,
  onResetTranslation
}) {
  if (isExtracting) {
    return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
      className: "ts-table-card"
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("table", {
      className: "ts-strings-table"
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("thead", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("tr", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("th", {
      style: {
        width: '48%'
      }
    }, "SOURCE TEXT"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("th", {
      style: {
        width: '52%'
      }
    }, "TRANSLATED TEXT"))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("tbody", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("tr", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("td", {
      colSpan: "2",
      style: {
        textAlign: 'center',
        padding: '18px 20px',
        background: '#f8fafc'
      }
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px'
      }
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
      className: "ts-circle-spinner"
    }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      style: {
        fontSize: '13px',
        fontWeight: '600',
        color: '#334155'
      }
    }, "Extracting page content & translatable strings...")))), [1, 2, 3].map((_, i) => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("tr", {
      key: i,
      className: "ts-skeleton-row"
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("td", {
      style: {
        padding: '16px 18px',
        verticalAlign: 'middle'
      }
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
      className: "ts-skeleton-shimmer",
      style: {
        width: i % 2 === 0 ? '78%' : '60%',
        height: '16px'
      }
    })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("td", {
      style: {
        padding: '16px 18px',
        verticalAlign: 'middle'
      }
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
      className: "ts-skeleton-shimmer",
      style: {
        width: '100%',
        height: '38px',
        borderRadius: '4px'
      }
    })))))));
  }
  const q = (filterQuery || '').toLowerCase().trim();
  const filtered = strings.map((item, idx) => ({
    ...item,
    originalIndex: idx
  })).filter(item => {
    if (!q) return true;
    const src = String(item.value || '').toLowerCase();
    const trans = String(item.translated || '').toLowerCase();
    return src.includes(q) || trans.includes(q);
  });
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-table-card"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("table", {
    className: "ts-strings-table"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("thead", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("tr", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("th", {
    style: {
      width: '48%'
    }
  }, "SOURCE TEXT"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("th", {
    style: {
      width: '52%'
    }
  }, "TRANSLATED TEXT"))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("tbody", {
    id: "ts-review-table-tbody"
  }, filtered.length === 0 ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("tr", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("td", {
    colSpan: "2",
    style: {
      textAlign: 'center',
      padding: '36px 20px',
      color: '#64748b'
    }
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    style: {
      fontSize: '24px',
      marginBottom: '8px'
    }
  }, "\uD83D\uDD0D"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", null, "No matching strings found for \"", (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("strong", null, filterQuery), "\"."))) : filtered.map(item => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_ReviewRow__WEBPACK_IMPORTED_MODULE_1__.ReviewRow, {
    key: item.hash || item.originalIndex,
    item: item,
    index: item.originalIndex,
    onUpdateTranslation: onUpdateTranslation,
    onResetTranslation: onResetTranslation
  })))));
}

/***/ },

/***/ "./src/page/components/SourcePrompt.jsx"
/*!**********************************************!*\
  !*** ./src/page/components/SourcePrompt.jsx ***!
  \**********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SourcePrompt: () => (/* binding */ SourcePrompt)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _components_Modal__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../components/Modal */ "./src/components/Modal/index.js");
/* harmony import */ var _components_Button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../components/Button */ "./src/components/Button/index.js");
/* harmony import */ var _utils_language__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../utils/language */ "./src/utils/language.js");

/**
 * SourcePrompt Component
 * Initial Page Load Translation Guidance Modal
 */




function SourcePrompt({
  isOpen,
  onClose,
  onConfirm,
  sourceLanguage,
  targetLanguage,
  languages = []
}) {
  if (!isOpen) return null;
  const srcLang = (0,_utils_language__WEBPACK_IMPORTED_MODULE_3__.getLanguageFlag)(sourceLanguage, languages);
  const tgtLang = (0,_utils_language__WEBPACK_IMPORTED_MODULE_3__.getLanguageFlag)(targetLanguage, languages);
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Modal__WEBPACK_IMPORTED_MODULE_1__.Modal, {
    isOpen: isOpen,
    onClose: onClose,
    size: "md",
    header: (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Modal__WEBPACK_IMPORTED_MODULE_1__.ModalHeader, {
      title: "Translate Page Content",
      subtitle: "Automatic Page Translation",
      onClose: onClose
    }),
    footer: (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Modal__WEBPACK_IMPORTED_MODULE_1__.ModalFooter, {
      align: "right"
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Button__WEBPACK_IMPORTED_MODULE_2__.Button, {
      variant: "secondary",
      onClick: onClose
    }, "Close"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_Button__WEBPACK_IMPORTED_MODULE_2__.Button, {
      variant: "primary",
      "data-ad": "ad-testing",
      onClick: onConfirm
    }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
      className: "dashicons dashicons-translation"
    }), "Continue to Translation"))
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-source-guidance-content"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    className: "ts-prompt-intro-text"
  }, "Automatically translate this page with AI while keeping your design and formatting intact."), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-prompt-languages-row"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-prompt-lang-pill source"
  }, srcLang.hasFlag && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("img", {
    src: srcLang.flagUrl,
    alt: srcLang.name,
    className: "ts-lang-flag-img"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", null, srcLang.name, " (", srcLang.code, ")")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-prompt-arrow-wrap",
    "aria-hidden": "true"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("svg", {
    viewBox: "0 0 576 512"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("path", {
    d: "M566.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-128-128c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L466.7 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l434.7 0-73.4 73.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l128-128z"
  }))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-prompt-lang-pill target"
  }, tgtLang.hasFlag && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("img", {
    src: tgtLang.flagUrl,
    alt: tgtLang.name,
    className: "ts-lang-flag-img"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", null, tgtLang.name, " (", tgtLang.code, ")"))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-prompt-steps-banner"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-prompt-steps-list"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-prompt-step-item"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-prompt-step-num"
  }, "1"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", null, "Select Provider")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-prompt-step-separator"
  }, ">"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-prompt-step-item"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-prompt-step-num"
  }, "2"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", null, "Start Translation")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-prompt-step-separator"
  }, ">"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-prompt-step-item"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-prompt-step-num"
  }, "3"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", null, "Apply to Page"))))));
}

/***/ },

/***/ "./src/page/components/TranslationProgress.jsx"
/*!*****************************************************!*\
  !*** ./src/page/components/TranslationProgress.jsx ***!
  \*****************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TranslationProgress: () => (/* binding */ TranslationProgress)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _utils_language__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../utils/language */ "./src/utils/language.js");

/**
 * TranslationProgress Component
 * Progress modal card with coffee visual and status bar
 */


function TranslationProgress({
  isOpen = false,
  percent = 0,
  status = 'Translation in progress...',
  subText = '',
  targetLang = 'es',
  languages = [],
  providerTitle = 'AI Provider',
  isExtracting = false
}) {
  if (!isOpen) return null;
  const clampedPercent = Math.min(100, Math.max(0, Math.round(percent)));
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-progress-modal-card",
    onClick: e => e.stopPropagation(),
    role: "dialog",
    "aria-modal": "true"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-coffee-visual"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-coffee-circle-bg"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("svg", {
    className: "ts-coffee-svg",
    width: "44",
    height: "44",
    viewBox: "0 0 64 64",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("path", {
    d: "M12 52C12 50.8954 12.8954 50 14 50H50C51.1046 50 52 50.8954 52 52C52 53.1046 51.1046 54 50 54H14C12.8954 54 12 53.1046 12 52Z",
    fill: "#94A3B8"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("path", {
    d: "M16 26H48V38C48 44.6274 42.6274 50 36 50H28C21.3726 50 16 44.6274 16 38V26Z",
    fill: "url(#tsCoffeeGrad)"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("path", {
    d: "M48 30H51C53.7614 30 56 32.2386 56 35C56 37.7614 53.7614 40 51 40H48",
    stroke: "#4F46E5",
    strokeWidth: "3.5",
    strokeLinecap: "round"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("path", {
    className: "ts-steam-line ts-steam-1",
    d: "M26 20C25 17 27 14 26 11",
    stroke: "#6366F1",
    strokeWidth: "2.5",
    strokeLinecap: "round"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("path", {
    className: "ts-steam-line ts-steam-2",
    d: "M32 21C31 17 33 13 32 9",
    stroke: "#6366F1",
    strokeWidth: "2.5",
    strokeLinecap: "round"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("path", {
    className: "ts-steam-line ts-steam-3",
    d: "M38 20C37 17 39 14 38 11",
    stroke: "#6366F1",
    strokeWidth: "2.5",
    strokeLinecap: "round"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("defs", null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("linearGradient", {
    id: "tsCoffeeGrad",
    x1: "16",
    y1: "26",
    x2: "48",
    y2: "50",
    gradientUnits: "userSpaceOnUse"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("stop", {
    stopColor: "#6366F1"
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("stop", {
    offset: "1",
    stopColor: "#4338CA"
  }))))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-progress-header-badge"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", null, "Translating to ", (0,_utils_language__WEBPACK_IMPORTED_MODULE_1__.getLanguageDisplay)(targetLang, languages))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("h3", {
    className: "ts-progress-title"
  }, isExtracting ? 'Extracting page content...' : 'Translation in progress...'), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    className: "ts-progress-coffee-quote"
  }, "Translation will take a few seconds or a minute, you can enjoy your coffee \u2615 during this process."), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-progress-section"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-progress-meta-top"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-progress-status-label"
  }, status), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-progress-percent-badge"
  }, clampedPercent, "%")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-progress-track-wrap"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-progress-track-fill",
    style: {
      width: `${clampedPercent}%`
    }
  })), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-progress-sub-info"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", null, subText), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-progress-provider-tag"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", null, "\u26A1"), " ", providerTitle))));
}

/***/ },

/***/ "./src/page/components/TranslationStats.jsx"
/*!**************************************************!*\
  !*** ./src/page/components/TranslationStats.jsx ***!
  \**************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TranslationStats: () => (/* binding */ TranslationStats)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _utils_formatting__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../utils/formatting */ "./src/utils/formatting.js");

/**
 * TranslationStats Component (Review Modal Toolbar Metrics)
 */


function TranslationStats({
  stats = {}
}) {
  const timeTaken = stats.timeTaken || '0.0s';
  const totalChars = stats.totalChars || 0;
  const stringCount = stats.stringCount || 0;
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-review-stats-group"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-stat-card time-card"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-stat-card-icon time",
    "aria-hidden": "true"
  }, "\u23F1\uFE0F"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-stat-card-meta"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-stat-card-lbl"
  }, "Time"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-stat-card-val"
  }, timeTaken))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-stat-card chars-card"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-stat-card-icon chars",
    "aria-hidden": "true"
  }, "\uD83D\uDCC4"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-stat-card-meta"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-stat-card-lbl"
  }, "Characters"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-stat-card-val"
  }, (0,_utils_formatting__WEBPACK_IMPORTED_MODULE_1__.formatNumber)(totalChars)))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-stat-card strings-card"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-stat-card-icon-tt",
    "aria-hidden": "true"
  }, "Tt"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "ts-stat-card-meta"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-stat-card-lbl"
  }, "Strings"), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span", {
    className: "ts-stat-card-val"
  }, stringCount))));
}

/***/ },

/***/ "./src/page/hooks/usePageEditor.js"
/*!*****************************************!*\
  !*** ./src/page/hooks/usePageEditor.js ***!
  \*****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   usePageEditor: () => (/* binding */ usePageEditor)
/* harmony export */ });
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _utils_editorStorage__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../utils/editorStorage */ "./src/utils/editorStorage.js");



/**
 * Hook to manage page editor environment integrations (Gutenberg, Elementor, Classic)
 */
function usePageEditor({
  onOpenProviderModal,
  onShowInitialPrompt,
  translation
}) {
  const config = typeof window !== 'undefined' && window.TranslateSenseEditorData || {};
  const editorType = config.editorType || 'classic';
  const sourcePostId = config.sourcePostId || 0;
  const fromPost = config.fromPost || 0;
  const showInitialPromptModal = Boolean(config.showInitialPromptModal);
  const hasCheckedEditorOpenRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useRef)(false);
  const isDirectlyOpeningProviderRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useRef)(false);

  // Initial prompt modal or direct provider modal on page load
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    const effectiveSourceId = sourcePostId || fromPost;
    if (effectiveSourceId <= 0) return;

    // In Elementor editor: check if coming from editorModal.js translate button click
    if (editorType === 'elementor' && !hasCheckedEditorOpenRef.current) {
      hasCheckedEditorOpenRef.current = true;
      const shouldDirectlyOpen = (0,_utils_editorStorage__WEBPACK_IMPORTED_MODULE_1__.checkAndConsumeEditorOpenFlag)(effectiveSourceId, config.targetLanguage);
      if (shouldDirectlyOpen) {
        isDirectlyOpeningProviderRef.current = true;
      }
    }

    // If flagged from editorModal.js, open Provider modal directly without showing SourcePrompt
    if (isDirectlyOpeningProviderRef.current) {
      const timer = setTimeout(() => {
        if (onOpenProviderModal) {
          onOpenProviderModal();
          translation.setIsSourcePromptOpen(false);
          isDirectlyOpeningProviderRef.current = false;
        }
      }, 800);
      return () => clearTimeout(timer);
    }
    if (!showInitialPromptModal) return;
    const timer = setTimeout(() => {
      if (onShowInitialPrompt) {
        onShowInitialPrompt();
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [showInitialPromptModal, sourcePostId, fromPost, editorType, config.targetLanguage, onOpenProviderModal, onShowInitialPrompt]);

  // Elementor integration: inject button into control footer panel
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    if (editorType !== 'elementor' || typeof window === 'undefined') return;
    const injectElementorButton = () => {
      if (document.getElementById('ts-elementor-translate-btn')) return;
      const elementorBtnGroup = document.querySelector('.MuiButtonGroup-root.MuiButtonGroup-contained');
      if (!elementorBtnGroup) return;
      const btnContainer = elementorBtnGroup.closest('.MuiGrid-root');
      if (!btnContainer) return;
      const translateBtn = document.createElement('button');
      translateBtn.id = 'ts-elementor-translate-btn';
      translateBtn.className = 'elementor-button elementor-button-default ts-open-translate-btn';
      translateBtn.style.cssText = 'width: 100%; background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); color: #fff; font-weight: 600; margin-bottom: 8px;';
      translateBtn.innerText = 'Translate Page';
      btnContainer.prepend(translateBtn);
    };
    if (window.jQuery) {
      window.jQuery(window).on('elementor:init', () => {
        if (window.elementor) {
          window.elementor.on('document:loaded', injectElementorButton);
        }
      });
    }

    // Try injecting directly if already loaded
    injectElementorButton();
  }, [editorType]);

  // Universal click listener for all translate buttons
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    const handleTriggerClick = e => {
      const trigger = e.target.closest('.ts-open-translate-btn, #ts-metabox-translate-btn, #ts-media-translate-btn, #ts-elementor-translate-btn, #ts-classic-translate-btn');
      if (!trigger) return;
      e.preventDefault();
      if (onOpenProviderModal) {
        onOpenProviderModal();
      }
    };
    document.addEventListener('click', handleTriggerClick);
    return () => document.removeEventListener('click', handleTriggerClick);
  }, [onOpenProviderModal]);
  const markButtonsApplied = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useCallback)(() => {
    const metaBoxBtn = document.getElementById('ts-metabox-translate-btn');
    if (metaBoxBtn) {
      const metaContent = metaBoxBtn.closest('.translatesense-metabox-content') || metaBoxBtn.parentElement;
      if (metaContent) {
        metaContent.innerText = 'Translations Applied';
        metaContent.className = 'disabled';
      }
    }
    const mediaBtn = document.getElementById('ts-media-translate-btn');
    if (mediaBtn) {
      mediaBtn.innerText = 'Translations Applied';
      mediaBtn.className = 'disabled';
    }
  }, []);
  return {
    editorType,
    config,
    markButtonsApplied
  };
}

/***/ },

/***/ "./src/page/hooks/usePageTranslation.js"
/*!**********************************************!*\
  !*** ./src/page/hooks/usePageTranslation.js ***!
  \**********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   usePageTranslation: () => (/* binding */ usePageTranslation)
/* harmony export */ });
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _services_providers_providerService__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../services/providers/providerService */ "./src/services/providers/providerService.js");
/* harmony import */ var _services_pageTranslationService__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../services/pageTranslationService */ "./src/page/services/pageTranslationService.js");
/* harmony import */ var _services_core_coreService__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../services/core/coreService */ "./src/services/core/coreService.js");
/* harmony import */ var _utils_validation__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../utils/validation */ "./src/utils/validation.js");
/* harmony import */ var _utils_formatting__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../../utils/formatting */ "./src/utils/formatting.js");






function usePageTranslation(config = {}) {
  const [isProviderModalOpen, setIsProviderModalOpen] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [isSourcePromptOpen, setIsSourcePromptOpen] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
  const [errorModal, setErrorModal] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)({
    isOpen: false,
    title: '',
    message: '',
    errorObj: null
  });
  const [providers, setProviders] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
  const [selectedProvider, setSelectedProvider] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)('openai');
  const [extractedStrings, setExtractedStrings] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
  const [strings, setStrings] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
  const [sourcePageData, setSourcePageData] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)(null);

  // Progress overlay state
  const [progress, setProgress] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)({
    isOpen: false,
    percent: 0,
    status: '',
    subText: '',
    isExtracting: false
  });

  // Stats
  const [translationStats, setTranslationStats] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)({
    timeTaken: '0.0s',
    timeTakenMs: 0,
    totalChars: 0,
    translatedChars: 0,
    stringCount: 0
  });
  const lastCompletedProviderRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useRef)('');
  const lastCompletedTargetLangRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useRef)('');
  const targetLang = config.targetLanguage || 'es';
  const sourceLang = config.sourceLanguage || config.defaultLanguage || 'en';
  const sourcePostId = config.sourcePostId || 0;
  const postId = config.postId || 0;
  const editorType = config.editorType || 'classic';

  // Load providers
  const loadProviders = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async () => {
    try {
      const list = await (0,_services_providers_providerService__WEBPACK_IMPORTED_MODULE_1__.getEvaluatedProviders)(sourceLang, targetLang);
      setProviders(list);
      const defaultProv = config.defaultProvider || '';
      let chosen = list.find(p => p.isAvailable && p.id === defaultProv)?.id;
      if (!chosen) {
        chosen = list.find(p => p.isAvailable)?.id || list[0]?.id || 'openai';
      }
      setSelectedProvider(chosen);
    } catch (err) {
      console.warn('[TranslateSense] Could not evaluate providers:', err);
    }
  }, [sourceLang, targetLang, config.defaultProvider]);

  // Check if translation is 100% completed in current session
  const isTranslationCompleted = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useCallback)(providerId => {
    const prov = providerId || selectedProvider;
    if (!prov || !Array.isArray(strings) || strings.length === 0) return false;
    if (lastCompletedProviderRef.current !== prov || lastCompletedTargetLangRef.current !== targetLang) {
      return false;
    }
    return strings.every(s => s.translated && String(s.translated).trim() !== '');
  }, [selectedProvider, strings, targetLang]);

  // Extract strings and run translation
  const extractAndTranslate = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (chosenProvider, forceRetranslate = false) => {
    const prov = chosenProvider || selectedProvider;
    const core = (0,_services_core_coreService__WEBPACK_IMPORTED_MODULE_3__.getCoreInstance)();
    setIsReviewModalOpen(true);

    // If translation already complete and not retranslating, directly open review modal
    if (!forceRetranslate && isTranslationCompleted(prov)) {
      return;
    }
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
      isExtracting: !forceRetranslate
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
        const res = await (0,_services_pageTranslationService__WEBPACK_IMPORTED_MODULE_2__.extractPostStrings)(sourcePostId, editorType, targetLang);
        rawStrings = Array.isArray(res.strings) ? res.strings : [];
        rawStrings = rawStrings.filter(s => !(0,_utils_validation__WEBPACK_IMPORTED_MODULE_4__.isEmailOrUrl)(s.value || ''));
        setExtractedStrings(rawStrings);
      } catch (err) {
        setProgress({
          isOpen: false,
          percent: 0,
          status: '',
          subText: '',
          isExtracting: false
        });
        setIsReviewModalOpen(false);
        alert('Extraction Error: ' + (err.message || 'Unknown error'));
        return;
      }
    }

    // 3. Prepare initial strings array checking Core cache
    const currentStrings = rawStrings.map(s => {
      let translated = '';
      let status = 'Pending';
      if (core && !forceRetranslate) {
        const cached = core.getTranslatedString(s.name, s.value, prov, s.name);
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
        providerTranslated: forceRetranslate ? '' : s.providerTranslated || translated || '',
        translated: forceRetranslate ? '' : translated,
        status
      };
    });
    setStrings(currentStrings);

    // Check if all already translated (skip check if forceRetranslate)
    const allDone = !forceRetranslate && currentStrings.length > 0 && currentStrings.every(s => s.translated && String(s.translated).trim() !== '');
    if (allDone) {
      lastCompletedProviderRef.current = prov;
      lastCompletedTargetLangRef.current = targetLang;
      setProgress({
        isOpen: false,
        percent: 100,
        status: '',
        subText: '',
        isExtracting: false
      });
      setIsReviewModalOpen(true);
      return;
    }

    // 4. Perform translation batch
    const total = currentStrings.length;
    setProgress({
      isOpen: true,
      percent: 15,
      status: 'Translating strings...',
      subText: `0 of ${total} strings translated`,
      isExtracting: false
    });
    const startTime = performance.now();
    const itemsToTranslate = currentStrings.map(s => ({
      hash: s.hash,
      widget_id: s.name,
      field: s.key,
      source: s.source || s.value,
      content: s.value
    }));
    try {
      if (core) {
        await core.translate(prov, {
          items: itemsToTranslate,
          sourceLang: sourceLang || 'en',
          targetLang,
          postId
        }, result => {
          setStrings(prevList => {
            const nextList = prevList.map(item => {
              if (item.value === result.source || result.hash && item.hash === result.hash) {
                if (core) {
                  core.saveSourceString(item.name, item.value, item.name);
                  core.saveTranslatedString(item.name, item.source, item.value, result.translated, prov, item.name);
                }
                return {
                  ...item,
                  providerTranslated: result.translated,
                  translated: result.translated,
                  status: result.status || 'Completed'
                };
              }
              return item;
            });
            const completedCount = nextList.filter(s => s.translated && s.translated.trim() !== '').length;
            const pct = Math.min(100, Math.max(15, Math.round(completedCount / total * 100)));
            setProgress({
              isOpen: true,
              percent: pct,
              status: `Translating strings... (${pct}%)`,
              subText: `${completedCount} of ${total} strings translated`,
              isExtracting: false
            });
            return nextList;
          });
        });
      }
      const elapsedMs = performance.now() - startTime;
      const totalSourceChars = currentStrings.reduce((sum, s) => sum + String(s.value || '').length, 0);
      setTranslationStats({
        timeTaken: (0,_utils_formatting__WEBPACK_IMPORTED_MODULE_5__.formatMs)(elapsedMs),
        timeTakenMs: Math.round(elapsedMs),
        totalChars: totalSourceChars,
        translatedChars: totalSourceChars,
        stringCount: total
      });
      setProgress({
        isOpen: true,
        percent: 100,
        status: '✓ Translation Completed (100%)',
        subText: `All ${total} strings translated successfully!`,
        isExtracting: false
      });
      lastCompletedProviderRef.current = prov;
      lastCompletedTargetLangRef.current = targetLang;

      // Graceful delay before closing progress modal and opening review modal
      setTimeout(() => {
        setProgress(p => ({
          ...p,
          isOpen: false
        }));
        setIsReviewModalOpen(true);
      }, 3500);
    } catch (err) {
      setProgress(p => ({
        ...p,
        isOpen: false
      }));
      setIsReviewModalOpen(false);
      alert('Translation Batch Error: ' + (err.message || 'Error'));
    }
  }, [selectedProvider, isTranslationCompleted, sourcePostId, sourcePageData, extractedStrings, editorType, targetLang, sourceLang, postId]);

  // Apply translations to active editor
  const applyTranslationsToPage = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async () => {
    const core = (0,_services_core_coreService__WEBPACK_IMPORTED_MODULE_3__.getCoreInstance)();

    // 1. Sync strings to Core
    if (core) {
      strings.forEach(s => {
        core.saveSourceString(s.name, s.value, s.name);
        core.saveTranslatedString(s.name, s.source || s.value, s.value, s.translated, selectedProvider, s.name);
      });
    }

    // 3. Apply via Editor registry
    const res = await core.applyToPageEditor(editorType, {
      strings,
      sourcePageData,
      options: {
        provider: selectedProvider
      }
    });
    setIsReviewModalOpen(false);

    // 2. Mark translated on server
    if (postId) {
      const totalChars = translationStats.totalChars || strings.reduce((sum, s) => sum + String(s.value || '').length, 0);
      const totalStrs = translationStats.stringCount || strings.length;
      (0,_services_pageTranslationService__WEBPACK_IMPORTED_MODULE_2__.markPostTranslated)({
        post_id: postId,
        status: 'success',
        total_characters: totalChars,
        total_strings: totalStrs,
        provider: selectedProvider || 'openai',
        time_take: translationStats.timeTakenMs || 0
      }).catch(err => console.warn('[TranslateSense] Could not update stats:', err));
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
    applyTranslationsToPage,
    isTranslationCompleted,
    targetLang,
    sourceLang
  };
}

/***/ },

/***/ "./src/page/services/pageTranslationService.js"
/*!*****************************************************!*\
  !*** ./src/page/services/pageTranslationService.js ***!
  \*****************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   extractPostStrings: () => (/* binding */ extractPostStrings),
/* harmony export */   markPostTranslated: () => (/* binding */ markPostTranslated),
/* harmony export */   translatePostServer: () => (/* binding */ translatePostServer)
/* harmony export */ });
/* harmony import */ var _services_api_apiClient__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../services/api/apiClient */ "./src/services/api/apiClient.js");
/* harmony import */ var _services_api_endpoints__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../services/api/endpoints */ "./src/services/api/endpoints.js");
/**
 * Page Editor Translation Service
 */




/**
 * Extract translatable strings from post content
 */
async function extractPostStrings(postId, builder, targetLang) {
  return await (0,_services_api_apiClient__WEBPACK_IMPORTED_MODULE_0__.apiRequest)(_services_api_endpoints__WEBPACK_IMPORTED_MODULE_1__.ENDPOINTS.EXTRACT_STRINGS, {
    method: 'POST',
    data: {
      post_id: Number(postId),
      builder,
      target_lang: targetLang
    }
  });
}

/**
 * Save mark-translated status and statistics to WordPress
 */
async function markPostTranslated(payload) {
  return await (0,_services_api_apiClient__WEBPACK_IMPORTED_MODULE_0__.apiRequest)(_services_api_endpoints__WEBPACK_IMPORTED_MODULE_1__.ENDPOINTS.MARK_TRANSLATED, {
    method: 'POST',
    data: payload
  });
}

/**
 * Fallback server translation of post
 */
async function translatePostServer(postId, targetLang, provider) {
  return await (0,_services_api_apiClient__WEBPACK_IMPORTED_MODULE_0__.apiRequest)(_services_api_endpoints__WEBPACK_IMPORTED_MODULE_1__.ENDPOINTS.TRANSLATE_POST, {
    method: 'POST',
    data: {
      post_id: Number(postId),
      target_lang: targetLang,
      provider
    }
  });
}

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

/***/ "./src/utils/editorStorage.js"
/*!************************************!*\
  !*** ./src/utils/editorStorage.js ***!
  \************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   EDITOR_OPEN_EXPIRY_MS: () => (/* binding */ EDITOR_OPEN_EXPIRY_MS),
/* harmony export */   EDITOR_OPEN_STORAGE_KEY: () => (/* binding */ EDITOR_OPEN_STORAGE_KEY),
/* harmony export */   checkAndConsumeEditorOpenFlag: () => (/* binding */ checkAndConsumeEditorOpenFlag),
/* harmony export */   getEditorOpenKey: () => (/* binding */ getEditorOpenKey),
/* harmony export */   removeEditorOpenFlag: () => (/* binding */ removeEditorOpenFlag),
/* harmony export */   setEditorOpenFlag: () => (/* binding */ setEditorOpenFlag)
/* harmony export */ });
/**
 * TranslateSense - Editor Navigation Storage Utilities
 * Manages localStorage state when navigating between editors (e.g. Classic/Gutenberg to Elementor)
 */

const EDITOR_OPEN_STORAGE_KEY = 'translateSenseEditorOpen';
const EDITOR_OPEN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Generates composite key from source post ID and target language.
 * Format: `${sourcePostId}_${targetLanguage}`
 *
 * @param {number|string} sourcePostId
 * @param {string} targetLang
 * @returns {string}
 */
function getEditorOpenKey(sourcePostId, targetLang) {
  const id = parseInt(sourcePostId, 10);
  if (!id || !targetLang) return '';
  return `${id}_${String(targetLang).trim().toLowerCase()}`;
}

/**
 * Sets an entry in `translateSenseEditorOpen` with 5 minutes.
 * Multiple posts are kept in the same object. Expired entries are pruned.
 *
 * @param {number|string} sourcePostId
 * @param {string} targetLang
 */
function setEditorOpenFlag(sourcePostId, targetLang) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const itemKey = getEditorOpenKey(sourcePostId, targetLang);
  if (!itemKey) return;
  try {
    const now = Date.now();
    const raw = window.localStorage.getItem(EDITOR_OPEN_STORAGE_KEY);
    let store = {};
    if (raw) {
      try {
        store = JSON.parse(raw) || {};
      } catch (e) {
        store = {};
      }
    }
    const cleaned = {};
    for (const [k, v] of Object.entries(store)) {
      const itemExpiry = v?.expiresAt;
      if (itemExpiry && itemExpiry > now) {
        cleaned[k] = v;
      }
    }
    cleaned[itemKey] = {
      sourcePostId: parseInt(sourcePostId, 10),
      targetLanguage: String(targetLang).trim().toLowerCase(),
      expiresAt: now + EDITOR_OPEN_EXPIRY_MS
    };
    window.localStorage.setItem(EDITOR_OPEN_STORAGE_KEY, JSON.stringify(cleaned));
  } catch (err) {
    console.warn('[TranslateSense] Could not set editor open flag in localStorage:', err);
  }
}

/**
 * Checks and consumes the editor open flag for the current post in Elementor editor.
 * If found and not expired:
 * - Deletes this specific post's key from the object.
 * - Prunes any other expired entries.
 * - If the object has no items left, completely deletes the localStorage key.
 * - Returns true.
 *
 * If not found or expired:
 * - Prunes any expired entries.
 * - If empty, removes the localStorage key.
 * - Returns false.
 *
 * @param {number|string} sourcePostId
 * @param {string} targetLang
 * @returns {boolean}
 */
function checkAndConsumeEditorOpenFlag(sourcePostId, targetLang) {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  const itemKey = getEditorOpenKey(sourcePostId, targetLang);
  if (!itemKey) return false;
  try {
    const raw = window.localStorage.getItem(EDITOR_OPEN_STORAGE_KEY);
    if (!raw) return false;
    let store = {};
    try {
      store = JSON.parse(raw) || {};
    } catch (e) {
      window.localStorage.removeItem(EDITOR_OPEN_STORAGE_KEY);
      return false;
    }
    const now = Date.now();
    let hasMatch = false;
    const cleaned = {};
    for (const [k, v] of Object.entries(store)) {
      const itemExpiry = v?.expiresAt;
      // Skip expired items
      if (!itemExpiry || itemExpiry <= now) {
        continue;
      }
      if (k === itemKey) {
        // Matched! Consume and delete it by not copying to cleaned
        hasMatch = true;
      } else {
        cleaned[k] = v;
      }
    }

    // If cleaned still has remaining unexpired items for other posts, update storage
    if (Object.keys(cleaned).length > 0) {
      window.localStorage.setItem(EDITOR_OPEN_STORAGE_KEY, JSON.stringify(cleaned));
    } else {
      // Once object doesn't have any items, delete the localStorage key entirely
      window.localStorage.removeItem(EDITOR_OPEN_STORAGE_KEY);
    }
    return hasMatch;
  } catch (err) {
    console.warn('[TranslateSense] Error checking editor open flag:', err);
    return false;
  }
}

/**
 * Removes the editor open flag for a given post if navigation was aborted or failed.
 *
 * @param {number|string} sourcePostId
 * @param {string} targetLang
 */
function removeEditorOpenFlag(sourcePostId, targetLang) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const itemKey = getEditorOpenKey(sourcePostId, targetLang);
  if (!itemKey) return;
  try {
    const raw = window.localStorage.getItem(EDITOR_OPEN_STORAGE_KEY);
    if (!raw) return;
    let store = {};
    try {
      store = JSON.parse(raw) || {};
    } catch (e) {
      window.localStorage.removeItem(EDITOR_OPEN_STORAGE_KEY);
      return;
    }
    delete store[itemKey];
    const now = Date.now();
    const cleaned = {};
    for (const [k, v] of Object.entries(store)) {
      const itemExpiry = v?.expiresAt;
      if (itemExpiry && itemExpiry > now) {
        cleaned[k] = v;
      }
    }
    if (Object.keys(cleaned).length > 0) {
      window.localStorage.setItem(EDITOR_OPEN_STORAGE_KEY, JSON.stringify(cleaned));
    } else {
      window.localStorage.removeItem(EDITOR_OPEN_STORAGE_KEY);
    }
  } catch (e) {}
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

/***/ "./src/styles/page.scss"
/*!******************************!*\
  !*** ./src/styles/page.scss ***!
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
  !*** ./src/page/index.jsx ***!
  \****************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _PageApp__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./PageApp */ "./src/page/PageApp.jsx");
/* harmony import */ var _styles_page_scss__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../styles/page.scss */ "./src/styles/page.scss");

/**
 * TranslateSense Universal Page Editor Entry Point
 */




function initPageEditor() {
  let rootEl = document.getElementById('translatesense-editor-portal-root');
  if (!rootEl) {
    rootEl = document.createElement('div');
    rootEl.id = 'translatesense-editor-portal-root';
    document.body.appendChild(rootEl);
  }
  if (rootEl && !rootEl._tsReactRoot) {
    const root = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.createRoot)(rootEl);
    rootEl._tsReactRoot = root;
    root.render((0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_PageApp__WEBPACK_IMPORTED_MODULE_2__.PageApp, null));
  }
}
if (window?.TranslateSenseEditorData && window?.TranslateSenseEditorData?.editorType === 'elementor') {
  jQuery(window).on('elementor:init', function () {
    elementor.on('document:loaded', initPageEditor);
  });
} else {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPageEditor);
  } else {
    initPageEditor();
  }
}
})();

/******/ })()
;
//# sourceMappingURL=index.js.map