/**
 * CryptoPulse Trade History Page Component
 * Fetches paginated trade history from GET /api/trades/history with
 * symbol/type/date-range filters, sorted most-recent-first.
 */

class HistoryPage {
  constructor(app) {
    this.app = app;
    this.trades = [];
    this.filters = { symbol: '', type: '', from: '', to: '' };
    this.page = 1;
    this.limit = 10;
    this.totalPages = 1;
    this.total = 0;
    this.listenersAttached = false;
  }

  /**
   * Wire up filters/pagination (once) and load the first page. Called on page enter.
   */
  async render() {
    this.setupEventListeners();
    this.populateSymbolOptions();
    await this.loadTrades();
  }

  setupEventListeners() {
    if (this.listenersAttached) return;
    this.listenersAttached = true;

    const symbolFilter = document.getElementById('history-symbol-filter');
    const typeFilter = document.getElementById('history-type-filter');
    const fromFilter = document.getElementById('history-from-filter');
    const toFilter = document.getElementById('history-to-filter');
    const clearBtn = document.getElementById('history-clear-filters');
    const prevBtn = document.getElementById('history-prev-page');
    const nextBtn = document.getElementById('history-next-page');

    if (symbolFilter) {
      symbolFilter.addEventListener('change', () => {
        this.filters.symbol = symbolFilter.value;
        this.page = 1;
        this.loadTrades();
      });
    }

    if (typeFilter) {
      typeFilter.addEventListener('change', () => {
        this.filters.type = typeFilter.value;
        this.page = 1;
        this.loadTrades();
      });
    }

    if (fromFilter) {
      fromFilter.addEventListener('change', () => {
        this.filters.from = fromFilter.value;
        this.page = 1;
        this.loadTrades();
      });
    }

    if (toFilter) {
      toFilter.addEventListener('change', () => {
        this.filters.to = toFilter.value;
        this.page = 1;
        this.loadTrades();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearFilters());
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.page > 1) {
          this.page -= 1;
          this.loadTrades();
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (this.page < this.totalPages) {
          this.page += 1;
          this.loadTrades();
        }
      });
    }
  }

  /**
   * Populate the symbol filter dropdown from known coins (app.prices).
   */
  populateSymbolOptions() {
    const symbolFilter = document.getElementById('history-symbol-filter');
    if (!symbolFilter || !this.app.prices || this.app.prices.size === 0) return;

    const currentValue = symbolFilter.value;
    const symbols = Array.from(this.app.prices.keys()).sort();

    symbolFilter.innerHTML = '<option value="">All Symbols</option>' +
      symbols.map(symbol => `<option value="${symbol}">${symbol}</option>`).join('');

    symbolFilter.value = currentValue;
  }

  clearFilters() {
    this.filters = { symbol: '', type: '', from: '', to: '' };
    this.page = 1;

    const symbolFilter = document.getElementById('history-symbol-filter');
    const typeFilter = document.getElementById('history-type-filter');
    const fromFilter = document.getElementById('history-from-filter');
    const toFilter = document.getElementById('history-to-filter');

    if (symbolFilter) symbolFilter.value = '';
    if (typeFilter) typeFilter.value = '';
    if (fromFilter) fromFilter.value = '';
    if (toFilter) toFilter.value = '';

    this.loadTrades();
  }

  async loadTrades() {
    const tbody = document.getElementById('trades-tbody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">Loading trades...</td></tr>';
    }

    try {
      const response = await api.getTradeHistory({
        symbol: this.filters.symbol || undefined,
        type: this.filters.type || undefined,
        from: this.filters.from || undefined,
        to: this.filters.to || undefined,
        page: this.page,
        limit: this.limit
      });

      this.trades = response?.trades || [];
      this.total = response?.total || 0;
      this.totalPages = response?.total_pages || 1;
      this.page = response?.page || this.page;
    } catch (error) {
      console.error('Failed to load trade history:', error);
      this.app.showToast('Failed to load trade history', 'error');
      this.trades = [];
      this.total = 0;
      this.totalPages = 1;
    }

    this.renderTable();
    this.renderPagination();
  }

  renderTable() {
    const tbody = document.getElementById('trades-tbody');
    if (!tbody) return;

    if (this.trades.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">No trades found</td></tr>';
      return;
    }

    tbody.innerHTML = this.trades.map(trade => `
      <tr>
        <td>${CryptoPulseAPI.formatDate(trade.created_at)}</td>
        <td>${trade.symbol}</td>
        <td>
          <span class="price-change ${trade.type === 'buy' ? 'positive' : 'negative'}">
            ${trade.type.toUpperCase()}
          </span>
        </td>
        <td>${CryptoPulseAPI.formatNumber(parseFloat(trade.quantity), 6)}</td>
        <td>${CryptoPulseAPI.formatCurrency(parseFloat(trade.unit_price))}</td>
        <td>${CryptoPulseAPI.formatCurrency(parseFloat(trade.total_value))}</td>
      </tr>
    `).join('');
  }

  renderPagination() {
    const indicator = document.getElementById('history-page-indicator');
    const prevBtn = document.getElementById('history-prev-page');
    const nextBtn = document.getElementById('history-next-page');

    if (indicator) {
      indicator.textContent = this.total === 0
        ? 'No results'
        : `Page ${this.page} of ${this.totalPages} (${this.total} trade${this.total === 1 ? '' : 's'})`;
    }

    if (prevBtn) prevBtn.disabled = this.page <= 1;
    if (nextBtn) nextBtn.disabled = this.page >= this.totalPages;
  }
}
