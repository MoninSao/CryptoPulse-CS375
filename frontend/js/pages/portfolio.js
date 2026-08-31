/**
 * CryptoPulse Portfolio Page Component
 * Fetches holdings + realized P&L from the backend, then keeps current price,
 * value, and unrealized P&L live by recomputing from the app's cached prices
 * on every WebSocket tick (no re-fetch needed for that part).
 */

class PortfolioPage {
  constructor(app) {
    this.app = app;
    this.positions = []; // { symbol, quantity, avg_cost_basis, realized_pnl }
    this.previousRowValues = new Map(); // symbol -> { current_price, unrealized_pnl }
    this.previousTotals = { value: null, pnl: null };
  }

  /**
   * Fetch holdings from the backend and render the page. Called on page enter.
   */
  async render() {
    await this.loadHoldings();
    this.renderPage();
  }

  async loadHoldings() {
    try {
      const data = await api.getHoldings();
      this.positions = (data?.holdings || []).map(h => ({
        symbol: h.symbol,
        quantity: parseFloat(h.quantity),
        avg_cost_basis: parseFloat(h.avg_cost_basis),
        realized_pnl: parseFloat(h.realized_pnl || 0)
      }));
    } catch (error) {
      console.error('Failed to load portfolio holdings:', error);
      this.app.showToast('Failed to load portfolio', 'error');
      this.positions = [];
    }
  }

  /**
   * Recompute live values from the app's cached prices and re-render.
   * Called after loading holdings and on every WebSocket price tick
   * while this page is active.
   */
  renderPage() {
    const rows = this.positions.map(pos => {
      const currentPrice = this.app.prices.get(pos.symbol) ?? 0;
      const currentValue = pos.quantity * currentPrice;
      const costBasisTotal = pos.avg_cost_basis * pos.quantity;
      const unrealizedPnl = currentValue - costBasisTotal;
      const pnlPercent = costBasisTotal > 0 ? (unrealizedPnl / costBasisTotal) * 100 : 0;
      return { ...pos, currentPrice, currentValue, unrealizedPnl, pnlPercent };
    });

    this.renderSummary(rows);
    this.renderTable(rows);
    this.updateTimestamp();
  }

  renderSummary(rows) {
    const totalValue = rows.reduce((sum, r) => sum + r.currentValue, 0);
    const totalPnl = rows.reduce((sum, r) => sum + r.unrealizedPnl, 0);
    const totalCostBasis = rows.reduce((sum, r) => sum + r.avg_cost_basis * r.quantity, 0);
    const totalPnlPercent = totalCostBasis > 0 ? (totalPnl / totalCostBasis) * 100 : 0;
    const pnlClass = totalPnl >= 0 ? 'positive' : 'negative';
    const pnlSign = totalPnl >= 0 ? '+' : '';

    const valueEl = document.getElementById('portfolio-total-value');
    const pnlEl = document.getElementById('portfolio-total-pnl');
    const pnlPercentEl = document.getElementById('portfolio-total-pnl-percent');

    if (valueEl) {
      valueEl.textContent = CryptoPulseAPI.formatCurrency(totalValue);
      this.applyFlash(valueEl, this.previousTotals.value, totalValue);
    }

    if (pnlEl) {
      pnlEl.textContent = CryptoPulseAPI.formatCurrency(totalPnl);
      pnlEl.className = `summary-value ${pnlClass}`;
      this.applyFlash(pnlEl, this.previousTotals.pnl, totalPnl);
    }

    if (pnlPercentEl) {
      pnlPercentEl.textContent = `${pnlSign}${totalPnlPercent.toFixed(2)}%`;
      pnlPercentEl.className = `summary-subvalue ${pnlClass}`;
    }

    this.previousTotals = { value: totalValue, pnl: totalPnl };
  }

  renderTable(rows) {
    const tbody = document.getElementById('holdings-tbody');
    if (!tbody) return;

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">No holdings yet</td></tr>';
      this.previousRowValues.clear();
      return;
    }

    const sortedRows = [...rows].sort((a, b) => a.symbol.localeCompare(b.symbol));

    tbody.innerHTML = sortedRows.map(row => {
      const prev = this.previousRowValues.get(row.symbol);
      const priceFlashClass = this.getFlashClass(prev?.current_price, row.currentPrice);
      const pnlFlashClass = this.getFlashClass(prev?.unrealized_pnl, row.unrealizedPnl);
      const pnlClass = row.unrealizedPnl >= 0 ? 'positive' : 'negative';
      const pnlSign = row.unrealizedPnl >= 0 ? '+' : '';

      return `
        <tr>
          <td>${row.symbol}</td>
          <td>${CryptoPulseAPI.formatNumber(row.quantity, 6)}</td>
          <td>${CryptoPulseAPI.formatCurrency(row.avg_cost_basis)}</td>
          <td class="${priceFlashClass}">${CryptoPulseAPI.formatCurrency(row.currentPrice)}</td>
          <td class="${priceFlashClass}">${CryptoPulseAPI.formatCurrency(row.currentValue)}</td>
          <td class="${pnlFlashClass}">
            <span class="price-change ${pnlClass}">${pnlSign}${CryptoPulseAPI.formatCurrency(row.unrealizedPnl)}</span>
          </td>
          <td class="${pnlFlashClass}">
            <span class="price-change ${pnlClass}">${pnlSign}${row.pnlPercent.toFixed(2)}%</span>
          </td>
        </tr>
      `;
    }).join('');

    sortedRows.forEach(row => {
      this.previousRowValues.set(row.symbol, {
        current_price: row.currentPrice,
        unrealized_pnl: row.unrealizedPnl
      });
    });
  }

  // Full-table rebuilds create fresh DOM nodes each render, so a flash class
  // present at creation time plays automatically without needing removal.
  getFlashClass(previous, current) {
    if (previous === undefined || previous === current) return '';
    return current > previous ? 'flash-up' : 'flash-down';
  }

  // The summary cards are updated in place (not rebuilt), so the flash
  // class has to be removed and re-added to restart the animation.
  applyFlash(el, previous, current) {
    if (previous === null || previous === undefined || previous === current) return;
    el.classList.remove('flash-up', 'flash-down');
    void el.offsetWidth; // force reflow so the animation restarts
    el.classList.add(current > previous ? 'flash-up' : 'flash-down');
  }

  updateTimestamp() {
    const el = document.getElementById('portfolio-timestamp');
    if (el && this.app.lastUpdateTime) {
      const date = new Date(this.app.lastUpdateTime);
      el.textContent = `Last updated: ${date.toLocaleTimeString()}`;
    }
  }

  /**
   * Called by the app on every WebSocket price tick while this page is active.
   */
  onPriceUpdate() {
    this.renderPage();
  }
}
