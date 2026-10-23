import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
  isNumeric?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  isLoading?: boolean;
  emptyMessage?: string;
  page?: number;
  totalPages?: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  className?: string;
  onRowClick?: (item: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyMessage = 'No records found in this view.',
  page,
  totalPages,
  totalItems,
  pageSize: _pageSize,
  onPageChange,
  className = '',
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className={`hhs-card ${className}`}>
      <div className="hhs-table-container" style={{ border: 'none', borderRadius: 0 }}>
        <table className="hhs-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  style={{
                    textAlign: col.align || 'left',
                    width: col.width,
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '32px' }}>
                  <span className="hhs-body-sm" style={{ color: 'var(--hhs-text-secondary)' }}>
                    Loading records...
                  </span>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '32px' }}>
                  <span className="hhs-body-sm" style={{ color: 'var(--hhs-text-muted)' }}>
                    {emptyMessage}
                  </span>
                </td>
              </tr>
            ) : (
              data.map((item, rowIdx) => (
                <tr
                  key={keyExtractor(item)}
                  onClick={e => {
                    if (!onRowClick) return;
                    const target = e.target as HTMLElement;
                    if (target.closest('button') || target.closest('a') || target.closest('input') || target.closest('select')) {
                      return;
                    }
                    onRowClick(item);
                  }}
                  style={{ cursor: onRowClick ? 'pointer' : undefined }}
                  className={onRowClick ? 'hhs-row-clickable' : ''}
                >
                  {columns.map(col => {
                    const value = (item as Record<string, unknown>)[col.key];
                    const content = col.render ? col.render(item, rowIdx) : (value as React.ReactNode);
                    return (
                      <td
                        key={col.key}
                        className={col.isNumeric ? 'numeric tnum' : ''}
                        style={{ textAlign: col.align || 'left' }}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages !== undefined && totalPages > 1 && onPageChange && page !== undefined && (
        <div
          style={{
            padding: '10px 18px',
            backgroundColor: 'var(--hhs-surface-muted)',
            borderTop: '1px solid var(--hhs-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            fontSize: '0.8rem',
            color: 'var(--hhs-text-secondary)',
          }}
        >
          <span>
            Showing page <strong style={{ color: 'var(--hhs-text-primary)' }}>{page}</strong> of{' '}
            <strong style={{ color: 'var(--hhs-text-primary)' }}>{totalPages}</strong>
            {totalItems !== undefined && ` (${totalItems} total records)`}
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1 || isLoading}
              onClick={() => onPageChange(page - 1)}
              icon={<ChevronLeft size={14} />}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= totalPages || isLoading}
              onClick={() => onPageChange(page + 1)}
              icon={<ChevronRight size={14} />}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
