export class Paginator {
  constructor({ 
    data,           // full array
    pageSize = 20,  // rows per page
    containerId,    // table tbody id
    renderRow,      // function(item) → <tr> HTML string
    renderCustom,   // function(items) → Void (handles own innerHTML)
    onUpdate,       // function(paginatedData)
    paginationId,   // pagination bar element id
    emptyHtml,      // HTML for empty state
    renderEmpty     // function() → HTML for empty state
  }) {
    this.data = data;
    this.pageSize = pageSize;
    this.currentPage = 1;
    this.containerId = containerId;
    this.renderRow = renderRow;
    this.renderCustom = renderCustom;
    this.onUpdate = onUpdate;
    this.paginationId = paginationId;
    this.emptyHtml = emptyHtml;
    this.renderEmpty = renderEmpty;
    this.totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  }
  
  get pageData() {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.data.slice(start, start + this.pageSize);
  }
  
  render() {
    const tbody = document.getElementById(this.containerId);
    const paginationBar = document.getElementById(this.paginationId);
    
    if (!tbody) return;

    if (this.data.length === 0) {
      const emptyContent = this.renderEmpty ? this.renderEmpty() : (this.emptyHtml || 'No data found');
      if (this.renderCustom) {
        this.renderCustom([]);
      } else {
        tbody.innerHTML = `<tr><td colspan="99">${emptyContent}</td></tr>`;
      }
      if (paginationBar) paginationBar.style.display = 'none';
      if (this.onUpdate) this.onUpdate([]);
      return;
    }
    
    const pData = this.pageData;
    if (this.renderCustom) {
      this.renderCustom(pData);
    } else {
      tbody.innerHTML = pData.map(this.renderRow).join('');
    }

    if (this.onUpdate) {
      this.onUpdate(pData);
    }

    if (paginationBar) {
      paginationBar.style.display = pData.length > 0 ? '' : 'none';
      this.renderPagination(paginationBar);
    }
  }
  
  renderPagination(bar) {
    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, this.data.length);
    
    // Build page number buttons (show max 5 page numbers)
    let pageButtons = '';
    const maxButtons = 5;
    let startPage = Math.max(1, this.currentPage - 2);
    let endPage = Math.min(this.totalPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }
    
    if (startPage > 1) pageButtons += `<button class="page-btn" data-page="1">1</button>`;
    if (startPage > 2) pageButtons += `<span class="page-ellipsis">…</span>`;
    
    for (let p = startPage; p <= endPage; p++) {
      pageButtons += `<button class="page-btn ${p === this.currentPage ? 'active' : ''}" 
        data-page="${p}">${p}</button>`;
    }
    
    if (endPage < this.totalPages - 1) pageButtons += `<span class="page-ellipsis">…</span>`;
    if (endPage < this.totalPages) {
      pageButtons += `<button class="page-btn" data-page="${this.totalPages}">${this.totalPages}</button>`;
    }
    
    bar.innerHTML = `
      <div class="pagination-info">
        Showing <strong>${start}–${end}</strong> of <strong>${this.data.length}</strong>
      </div>
      <div class="pagination-controls">
        <button class="page-btn" data-page="${this.currentPage - 1}" 
          ${this.currentPage === 1 ? 'disabled' : ''}>‹</button>
        ${pageButtons}
        <button class="page-btn" data-page="${this.currentPage + 1}"
          ${this.currentPage === this.totalPages ? 'disabled' : ''}>›</button>
      </div>
    `;
    
    bar.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentPage = parseInt(btn.dataset.page);
        this.render();
        // Scroll table into view on mobile
        document.getElementById(this.containerId)
          ?.closest('.table-container')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }
  
  // Update data (after filtering/config change)
  update(newData, newConfig = {}) {
    this.data = newData;
    if (newConfig.renderRow) this.renderRow = newConfig.renderRow;
    if (newConfig.emptyHtml) this.emptyHtml = newConfig.emptyHtml;
    this.totalPages = Math.max(1, Math.ceil(newData.length / this.pageSize));
    this.currentPage = 1;
    this.render();
  }
}
