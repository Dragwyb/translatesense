/**
 * Reusable SearchInput Component
 */

export function SearchInput({
  value = '',
  onChange,
  placeholder = 'Search...',
  disabled = false,
  className = '',
  autoFocus = false,
  id = '',
  name = '',
}) {
  const handleClear = () => {
    if (onChange) {
      onChange({ target: { value: '' } });
    }
  };

  return (
    <div className={`ts-search-input-wrap ${className}`}>
      <span className="ts-search-icon" aria-hidden="true">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </span>
      <input
        id={id || undefined}
        name={name || undefined}
        type="text"
        className="ts-search-input-field"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        autoFocus={autoFocus}
      />
      {value && !disabled && (
        <button
          type="button"
          className="ts-search-clear-btn"
          onClick={handleClear}
          title="Clear search"
          aria-label="Clear search"
        >
          &times;
        </button>
      )}
    </div>
  );
}

