import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface PaginationProps {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

function getPageNumbers(current: number, totalPages: number): number[] {
  if (totalPages <= 1) return [1];

  const maxVisible = 5;
  let start = Math.max(1, current - Math.floor(maxVisible / 2));
  let end = start + maxVisible - 1;

  if (end > totalPages) {
    end = totalPages;
    start = Math.max(1, end - maxVisible + 1);
  }

  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export const Pagination: React.FC<PaginationProps> = ({ pagination, onPageChange, loading = false }) => {
  const { page, pageSize, total, totalPages } = pagination;
  const safeTotalPages = Math.max(totalPages, 1);
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = total === 0 ? 0 : Math.min(page * pageSize, total);
  const pageNumbers = getPageNumbers(page, safeTotalPages);

  return (
    <div className="pagination-bar">
      <span className="pagination-summary">
        {total === 0
          ? 'No entries'
          : `Showing ${start}–${end} of ${total}`}
      </span>

      <div className="pagination-controls">
        <button
          type="button"
          className="btn btn-secondary pagination-btn"
          disabled={loading || page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
          Previous
        </button>

        <div className="pagination-pages">
          {pageNumbers.map((pageNum) => (
            <button
              key={pageNum}
              type="button"
              className={`pagination-page${pageNum === page ? ' active' : ''}`}
              disabled={loading || pageNum === page}
              onClick={() => onPageChange(pageNum)}
              aria-label={`Page ${pageNum}`}
              aria-current={pageNum === page ? 'page' : undefined}
            >
              {pageNum}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn btn-secondary pagination-btn"
          disabled={loading || page >= safeTotalPages || total === 0}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
