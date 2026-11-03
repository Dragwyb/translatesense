/**
 * BuilderConfigTab Component - Gutenberg Blocks & Elementor Widgets Manager
 */

import { useState, useMemo } from '@wordpress/element';
import { WidgetCard } from './WidgetCard';
import { WidgetTableRow } from './WidgetTableRow';
import { PaginationBar } from './PaginationBar';
import { DashboardIcons } from './DashboardIcons';

export function BuilderConfigTab({
  activeTab,
  widgets = [],
  onOpenXmlModal,
  onGenerateSandbox,
  isCreatingSandbox = false,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('status');
  const [viewMode, setViewMode] = useState('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Derive unique categories
  const availableCategories = useMemo(() => {
    const set = new Set();
    widgets.forEach((w) => {
      if (w.category && typeof w.category === 'string') {
        if (w.category.includes(',')) {
          const catArray = w.category.split(',');
          catArray.forEach((cat) => set.add(cat.trim()));
        } else {
          set.add(w.category);
        }
      }
    });
    return Array.from(set).sort();
  }, [widgets]);

  // Filter and sort items
  const filteredWidgets = useMemo(() => {
    let items = [...widgets];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(
        (w) =>
          (w.name && w.name.toLowerCase().includes(q)) ||
          (w.id && w.id.toLowerCase().includes(q))
      );
    }

    if (selectedCategory !== 'all') {
      items = items.filter((w) => w.category === selectedCategory);
    }

    if (selectedStatus !== 'all') {
      items = items.filter((w) => {
        if (selectedStatus === 'supported') return w.status === 'supported' || w.status === 'custom';
        if (selectedStatus === 'custom') return w.status === 'custom';
        if (selectedStatus === 'unsupported') return w.status === 'unsupported';
        return true;
      });
    }

    items.sort((a, b) => {
      if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '');
      if (sortBy === 'fields_desc') return (b.field_count || 0) - (a.field_count || 0);
      if (sortBy === 'fields_asc') return (a.field_count || 0) - (b.field_count || 0);
      if (sortBy === 'status') {
        const order = { custom: 1, supported: 2, unsupported: 3 };
        return (order[a.status] || 99) - (order[b.status] || 99);
      }
      return 0;
    });

    return items;
  }, [widgets, searchQuery, selectedCategory, selectedStatus, sortBy]);

  // Pagination
  const totalItems = filteredWidgets.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedWidgets = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return filteredWidgets.slice(start, start + pageSize);
  }, [filteredWidgets, validCurrentPage, pageSize]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedStatus('all');
    setSortBy('status');
    setCurrentPage(1);
  };

  const isFiltered =
    searchQuery.trim() !== '' ||
    selectedCategory !== 'all' ||
    selectedStatus !== 'all' ||
    sortBy !== 'status';

  const builderName = activeTab === 'gutenberg' ? 'Gutenberg' : 'Elementor';
  const unitName = activeTab === 'gutenberg' ? 'blocks' : 'widgets';

  return (
    <div>
      {/* Search & Filter Card */}
      <div className="ts-filter-card">
        {/* Row 1: Search + 3 Dropdowns */}
        <div className="ts-filter-row-top">
          <div className="ts-search-box">
            <span className="ts-search-icon">{DashboardIcons.search()}</span>
            <input
              type="text"
              className="ts-search-input"
              placeholder={`Search ${builderName} ${unitName}...`}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <select
            className="ts-filter-select"
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Categories</option>
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>

          <select
            className="ts-filter-select"
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Statuses</option>
            <option value="supported">Supported</option>
            <option value="custom">Custom Config</option>
            <option value="unsupported">Unsupported</option>
          </select>

          <select
            className="ts-filter-select"
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="name_asc">Name (A to Z)</option>
            <option value="name_desc">Name (Z to A)</option>
            <option value="fields_desc">Fields (High to Low)</option>
            <option value="fields_asc">Fields (Low to High)</option>
            <option value="status">Status (Supported first)</option>
          </select>
        </div>

        {/* Row 2: View Switcher (Left) + Actions (Right) */}
        <div className="ts-filter-row-bottom">
          <div className="ts-view-switcher-group">
            <div className="ts-view-switcher">
              <button
                type="button"
                className={`ts-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
              >
                Grid
              </button>
              <button
                type="button"
                className={`ts-view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                List
              </button>
            </div>
            {isFiltered && (
              <button
                type="button"
                className="ts-reset-filter-btn"
                onClick={handleResetFilters}
              >
                Reset
              </button>
            )}
          </div>

          <div className="ts-filter-actions-right">
            <button
              type="button"
              className="ts-btn-action-primary"
              disabled={isCreatingSandbox}
              onClick={() => onGenerateSandbox && onGenerateSandbox(activeTab)}
            >
              {isCreatingSandbox ? 'Opening...' : `Generate ${builderName} Config`}
            </button>
            <button
              type="button"
              className="ts-btn-action-outline"
              onClick={() => onOpenXmlModal && onOpenXmlModal(activeTab, null)}
            >
              <span style={{ display: 'inline-flex', marginRight: '6px' }}>
                {DashboardIcons.pencil({ size: 13 })}
              </span>
              {`Edit ${builderName} Config`}
            </button>
          </div>
        </div>
      </div>

      {/* Grid or Table List */}
      {viewMode === 'grid' ? (
        <div>
          <div className="ts-widget-grid">
            {paginatedWidgets.length > 0 ? (
              paginatedWidgets.map((widget) => (
                <WidgetCard
                  key={widget.id}
                  widget={widget}
                  activeTab={activeTab}
                  onEdit={(w) => onOpenXmlModal && onOpenXmlModal(activeTab, w)}
                  onGenerate={(w) => onGenerateSandbox && onGenerateSandbox(activeTab, w.id)}
                />
              ))
            ) : (
              <div className="ts-empty-state" style={{ gridColumn: '1 / -1', padding: '40px 20px', textAlign: 'center' }}>
                <p>No matching {unitName} found for the selected filters.</p>
              </div>
            )}
          </div>
          <PaginationBar
            currentPage={validCurrentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            activeTab={activeTab}
            onPageChange={setCurrentPage}
          />
        </div>
      ) : (
        <div className="ts-table-container">
          <table className="ts-list-table">
            <thead>
              <tr>
                <th style={{ width: '28%' }}>{builderName.toUpperCase()} {unitName.toUpperCase()}</th>
                <th style={{ width: '15%' }}>CATEGORY</th>
                <th style={{ width: '28%' }}>MAPPED FIELDS</th>
                <th style={{ width: '14%' }}>STATUS</th>
                <th style={{ width: '15%', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {paginatedWidgets.length > 0 ? (
                paginatedWidgets.map((widget) => (
                  <WidgetTableRow
                    key={widget.id}
                    widget={widget}
                    onEdit={(w) => onOpenXmlModal && onOpenXmlModal(activeTab, w)}
                    onGenerate={(w) => onGenerateSandbox && onGenerateSandbox(activeTab, w.id)}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '30px' }}>
                    No matching {unitName} found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <PaginationBar
            currentPage={validCurrentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            activeTab={activeTab}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  );
}
