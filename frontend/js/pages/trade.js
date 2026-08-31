/**
 * CryptoPulse Trade Page Component
 * Handles Buy/Sell trading functionality with forms, validation, and API integration
 */

class TradePage {
  constructor(app) {
    this.app = app;
    this.selectedCoin = null;
    this.currentPrice = null;
    this.change24h = null;
    this.userHoldings = new Map();
    this.isProcessing = false;
    this.alerts = [];
    this.isAlertProcessing = false;
  }

  /**
   * Initialize the trade page
   */
  async init() {
    this.setupEventListeners();
    await this.loadUserHoldings();
    await this.loadAlerts();
  }

  /**
   * Setup all event listeners for the trade page
   */
  setupEventListeners() {
    // Coin search input
    const coinSearch = document.getElementById('coin-search');
    if (coinSearch) {
      coinSearch.addEventListener('input', (e) => this.handleCoinSearch(e));
    }

    // Coin dropdown options
    const coinDropdown = document.getElementById('coin-dropdown');
    if (coinDropdown) {
      coinDropdown.addEventListener('click', (e) => this.handleCoinSelect(e));
    }

    // Buy form
    const buyForm = document.getElementById('buy-form');
    if (buyForm) {
      buyForm.addEventListener('submit', (e) => this.handleBuySubmit(e));
    }

    // Sell form
    const sellForm = document.getElementById('sell-form');
    if (sellForm) {
      sellForm.addEventListener('submit', (e) => this.handleSellSubmit(e));
    }

    // Quantity inputs for live calculations
    const buyQuantityInput = document.getElementById('buy-quantity');
    if (buyQuantityInput) {
      buyQuantityInput.addEventListener('input', () => this.updateBuySummary());
    }

    const sellQuantityInput = document.getElementById('sell-quantity');
    if (sellQuantityInput) {
      sellQuantityInput.addEventListener('input', () => this.updateSellSummary());
    }

    // Max button for sell form
    const sellMaxBtn = document.getElementById('sell-max-btn');
    if (sellMaxBtn) {
      sellMaxBtn.addEventListener('click', () => this.setSellMaxQuantity());
    }

    // Buy limit order (price alert) form
    const alertForm = document.getElementById('alert-form');
    if (alertForm) {
      alertForm.addEventListener('submit', (e) => this.handleAlertSubmit(e));
    }

    const alertTargetPriceInput = document.getElementById('alert-target-price');
    if (alertTargetPriceInput) {
      alertTargetPriceInput.addEventListener('input', () => this.updateAlertFormState());
    }

    const alertQuantityInput = document.getElementById('alert-quantity');
    if (alertQuantityInput) {
      alertQuantityInput.addEventListener('input', () => this.updateAlertFormState());
    }

    const alertList = document.getElementById('alert-list');
    if (alertList) {
      alertList.addEventListener('click', (e) => this.handleAlertListClick(e));
    }
  }

  /**
   * Load user holdings from app
   */
  async loadUserHoldings() {
    if (this.app && this.app.holdings) {
      this.userHoldings = new Map(this.app.holdings);
    }
  }

  /**
   * Handle coin search input
   */
  handleCoinSearch(event) {
    const searchTerm = event.target.value.toLowerCase().trim();
    const dropdown = document.getElementById('coin-dropdown');

    if (!dropdown) return;

    if (searchTerm.length === 0) {
      dropdown.classList.remove('show');
      return;
    }

    dropdown.innerHTML = '';

    if (!this.app || !this.app.prices || this.app.prices.size === 0) {
      dropdown.innerHTML = '<div class="dropdown-item disabled">No coins available</div>';
      dropdown.classList.add('show');
      return;
    }

    // Filter coins based on search term (matches symbol or full name).
    // No result cap here - a substring match like "btc" hits every wrapped/
    // leveraged token too (WBTC, BTCB, BTCUP, ...), and Redis key order isn't
    // rank-sorted, so a hard slice could cut the real coin out entirely.
    // Sort by market cap rank instead so the coin you're looking for is first.
    const filteredCoins = Array.from(this.app.prices.entries())
      .filter(([coinId]) => {
        const coinName = this.app.meta?.get(coinId)?.name || '';
        return coinId.toLowerCase().includes(searchTerm) || coinName.toLowerCase().includes(searchTerm);
      })
      .sort(([coinIdA], [coinIdB]) => {
        const rankA = this.app.meta?.get(coinIdA)?.market_cap_rank ?? Infinity;
        const rankB = this.app.meta?.get(coinIdB)?.market_cap_rank ?? Infinity;
        return rankA - rankB;
      });

    if (filteredCoins.length === 0) {
      dropdown.innerHTML = '<div class="dropdown-item disabled">No coins found</div>';
      dropdown.classList.add('show');
      return;
    }

    filteredCoins.forEach(([coinId, price]) => {
      const change24h = this.app.changes.get(coinId) || 0;
      const changeClass = change24h >= 0 ? 'positive' : 'negative';
      const changeSymbol = change24h >= 0 ? '+' : '';
      const meta = this.app.meta?.get(coinId);
      const coinName = meta?.name || coinId.toUpperCase();

      const item = document.createElement('div');
      item.className = 'dropdown-item';
      item.dataset.coin = coinId;
      item.innerHTML = `
        <div class="dropdown-item-info">
          ${meta?.image ? `<img class="coin-logo coin-logo-sm" src="${meta.image}" alt="${coinName}" onerror="this.remove()">` : ''}
          <div class="dropdown-item-text">
            <span class="dropdown-item-name">${coinName}</span>
            <span class="dropdown-item-price">${CryptoPulseAPI.formatCurrency(price)}</span>
          </div>
        </div>
        <span class="dropdown-item-change ${changeClass}">
          ${changeSymbol}${change24h.toFixed(2)}%
        </span>
      `;

      item.addEventListener('click', () => this.handleCoinSelect({ target: item }));
      dropdown.appendChild(item);
    });

    dropdown.classList.add('show');
  }

  /**
   * Handle coin selection from dropdown
   */
  handleCoinSelect(event) {
    const coinItem = event.target.closest('.dropdown-item');
    if (!coinItem) return;

    const coinId = coinItem.dataset.coin;
    this.selectCoin(coinId);
  }

  /**
   * Select a coin and update displays
   */
  selectCoin(coinId) {
    if (!this.app || !this.app.prices || !this.app.prices.has(coinId)) {
      this.app.showToast('Invalid coin selected', 'error');
      return;
    }

    this.selectedCoin = coinId;
    this.currentPrice = this.app.prices.get(coinId);
    this.change24h = this.app.changes.get(coinId) || 0;

    // Update UI
    this.updateCoinDisplay();
    this.updatePriceDisplay();
    this.updateSellMaxQuantity();
    this.resetForms();
    this.updateBuySummary();
    this.updateSellSummary();
    this.renderAlertList();
    this.updateAlertFormState();

    // Hide dropdown
    const dropdown = document.getElementById('coin-dropdown');
    if (dropdown) {
      dropdown.classList.remove('show');
    }
  }

  /**
   * Update coin name display in search bar
   */
  updateCoinDisplay() {
    const coinSearch = document.getElementById('coin-search');
    if (coinSearch) {
      coinSearch.value = this.selectedCoin ? this.selectedCoin.toUpperCase() : '';
      coinSearch.placeholder = 'Search or select a coin...';
    }
  }

  /**
   * Update current price display
   */
  updatePriceDisplay() {
    const priceDisplay = document.getElementById('coin-price-display');
    const changeDisplay = document.getElementById('coin-change-display');
    const priceSection = document.getElementById('coin-info-section');
    const nameDisplay = document.getElementById('coin-name-display');
    const buyUnitPrice = document.getElementById('buy-unit-price');
    const sellUnitPrice = document.getElementById('sell-unit-price');

    if (!priceDisplay || !changeDisplay || !priceSection) return;

    if (!this.selectedCoin) {
      priceSection.classList.add('hidden');
      return;
    }

    priceSection.classList.remove('hidden');
    priceDisplay.textContent = CryptoPulseAPI.formatCurrency(this.currentPrice);

    if (nameDisplay) {
      const meta = this.app.meta?.get(this.selectedCoin);
      nameDisplay.textContent = meta?.name || this.selectedCoin.toUpperCase();
    }

    const changeClass = this.change24h >= 0 ? 'positive' : 'negative';
    const changeSymbol = this.change24h >= 0 ? '+' : '';
    changeDisplay.textContent = `${changeSymbol}${this.change24h.toFixed(2)}%`;
    changeDisplay.className = `change-badge ${changeClass}`;

    // Update unit prices in forms
    if (buyUnitPrice) {
      buyUnitPrice.textContent = CryptoPulseAPI.formatCurrency(this.currentPrice);
    }
    if (sellUnitPrice) {
      sellUnitPrice.textContent = CryptoPulseAPI.formatCurrency(this.currentPrice);
    }
  }

  /**
   * Update buy summary calculations
   */
  updateBuySummary() {
    if (!this.selectedCoin || !this.currentPrice) return;

    const quantityInput = document.getElementById('buy-quantity');
    const totalDisplay = document.getElementById('buy-total-cost');

    if (!quantityInput || !totalDisplay) return;

    const quantity = parseFloat(quantityInput.value) || 0;
    const totalCost = quantity * this.currentPrice;

    totalDisplay.textContent = CryptoPulseAPI.formatCurrency(totalCost);

    // Disable submit button if quantity is invalid
    const buyForm = document.getElementById('buy-form');
    const submitBtn = buyForm?.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = quantity <= 0;
    }
  }

  /**
   * Update sell summary calculations
   */
  updateSellSummary() {
    if (!this.selectedCoin || !this.currentPrice) return;

    const quantityInput = document.getElementById('sell-quantity');
    const proceedsDisplay = document.getElementById('sell-total-proceeds');
    const maxQuantity = this.userHoldings.get(this.selectedCoin)?.quantity || 0;

    if (!quantityInput || !proceedsDisplay) return;

    const quantity = parseFloat(quantityInput.value) || 0;

    // Validate quantity doesn't exceed holdings
    if (quantity > maxQuantity) {
      quantityInput.value = maxQuantity;
      quantityInput.dispatchEvent(new Event('input'));
      return;
    }

    const proceeds = quantity * this.currentPrice;
    proceedsDisplay.textContent = CryptoPulseAPI.formatCurrency(proceeds);

    // Disable submit button if quantity is invalid
    const sellForm = document.getElementById('sell-form');
    const submitBtn = sellForm?.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = quantity <= 0 || quantity > maxQuantity;
    }
  }

  /**
   * Set sell quantity to maximum holdings
   */
  setSellMaxQuantity() {
    if (!this.selectedCoin) {
      this.app.showToast('Please select a coin first', 'warning');
      return;
    }

    const maxQuantity = this.userHoldings.get(this.selectedCoin)?.quantity || 0;

    if (maxQuantity === 0) {
      this.app.showToast('You do not have any holdings of this coin', 'warning');
      return;
    }

    const quantityInput = document.getElementById('sell-quantity');
    if (quantityInput) {
      quantityInput.value = maxQuantity;
      quantityInput.dispatchEvent(new Event('input'));
    }
  }

  /**
   * Update sell maximum quantity display
   */
  updateSellMaxQuantity() {
    const availableBalance = document.getElementById('available-balance');
    if (!availableBalance || !this.selectedCoin) return;

    const maxQuantity = this.userHoldings.get(this.selectedCoin)?.quantity || 0;
    availableBalance.textContent = `Available: ${CryptoPulseAPI.formatNumber(maxQuantity)}`;
  }

  /**
   * Reset all forms
   */
  resetForms() {
    const buyForm = document.getElementById('buy-form');
    const sellForm = document.getElementById('sell-form');
    const alertForm = document.getElementById('alert-form');

    if (buyForm) {
      buyForm.reset();
      document.getElementById('buy-total-cost').textContent = '$0.00';
    }

    if (sellForm) {
      sellForm.reset();
      document.getElementById('sell-total-proceeds').textContent = '$0.00';
    }

    if (alertForm) {
      alertForm.reset();
    }
  }

  /**
   * Load all price alerts from the backend
   */
  async loadAlerts() {
    try {
      const response = await api.request('/alerts');
      this.alerts = (response && response.alerts) || [];
    } catch (error) {
      console.error('Failed to load alerts:', error);
      this.alerts = [];
    }
    this.renderAlertList();
  }

  /**
   * Enable/disable the alert form's submit button based on current input validity
   */
  updateAlertFormState() {
    const alertForm = document.getElementById('alert-form');
    const submitBtn = alertForm?.querySelector('button[type="submit"]');
    if (!submitBtn) return;

    const targetPrice = parseFloat(document.getElementById('alert-target-price')?.value);
    const quantity = parseFloat(document.getElementById('alert-quantity')?.value);

    const valid =
      this.selectedCoin &&
      this.currentPrice &&
      quantity > 0 &&
      targetPrice > 0 &&
      targetPrice < this.currentPrice;

    submitBtn.disabled = !valid;
  }

  /**
   * Render the list of pending alerts for the currently selected coin.
   * Recomputed from cached data on every price tick, so it needs no
   * network call to keep "distance to target" live.
   */
  renderAlertList() {
    const alertList = document.getElementById('alert-list');
    if (!alertList) return;

    if (!this.selectedCoin) {
      alertList.innerHTML = '<p class="placeholder-text">Select a coin to see its buy limit orders</p>';
      return;
    }

    const pendingAlerts = this.alerts.filter(
      (alert) => alert.status === 'pending' && alert.symbol === this.selectedCoin.toUpperCase()
    );

    if (pendingAlerts.length === 0) {
      alertList.innerHTML = '<p class="placeholder-text">No active alerts</p>';
      return;
    }

    alertList.innerHTML = pendingAlerts
      .map((alert) => {
        const targetPrice = parseFloat(alert.target_price);
        const distancePct = this.currentPrice
          ? (((this.currentPrice - targetPrice) / this.currentPrice) * 100).toFixed(2)
          : '-';

        return `
          <div class="alert-card" data-alert-id="${alert.id}">
            <div class="alert-card-info">
              <span class="detail-label">Buy ${CryptoPulseAPI.formatNumber(parseFloat(alert.quantity))} ${alert.symbol}</span>
              <span class="detail-label">at or below ${CryptoPulseAPI.formatCurrency(targetPrice)}</span>
              <span class="detail-label">${distancePct}% above target</span>
            </div>
            <button type="button" class="btn btn-sm btn-danger alert-cancel-btn" data-alert-id="${alert.id}">Cancel</button>
          </div>
        `;
      })
      .join('');
  }

  /**
   * Handle clicks within the alert list (event delegation for Cancel buttons)
   */
  handleAlertListClick(event) {
    const cancelBtn = event.target.closest('.alert-cancel-btn');
    if (!cancelBtn) return;

    const alertId = cancelBtn.dataset.alertId;
    if (alertId) {
      this.handleCancelAlert(alertId);
    }
  }

  /**
   * Handle buy limit order (price alert) form submission
   */
  async handleAlertSubmit(event) {
    event.preventDefault();

    if (!this.selectedCoin || !this.currentPrice) {
      this.app.showToast('Please select a coin first', 'error');
      return;
    }

    const targetPrice = parseFloat(document.getElementById('alert-target-price').value);
    const quantity = parseFloat(document.getElementById('alert-quantity').value);

    if (!quantity || quantity <= 0 || !Number.isFinite(quantity)) {
      this.app.showToast('Please enter a valid quantity', 'error');
      return;
    }

    if (!targetPrice || targetPrice <= 0 || !Number.isFinite(targetPrice)) {
      this.app.showToast('Please enter a valid target price', 'error');
      return;
    }

    if (targetPrice >= this.currentPrice) {
      this.app.showToast('Target price must be below the current price', 'error');
      return;
    }

    if (this.isAlertProcessing) {
      return;
    }

    this.isAlertProcessing = true;

    try {
      this.app.showSpinner(true);

      await api.request('/alerts', {
        method: 'POST',
        body: {
          symbol: this.selectedCoin,
          target_price: targetPrice,
          quantity: quantity
        }
      });

      await this.loadAlerts();

      this.app.showToast(
        `⏰ Buy limit order created: ${quantity} ${this.selectedCoin.toUpperCase()} at ${CryptoPulseAPI.formatCurrency(targetPrice)}`,
        'success'
      );

      document.getElementById('alert-form').reset();
      this.updateAlertFormState();
    } catch (error) {
      console.error('Create alert error:', error);
      const errorMsg = error.message || 'Failed to create alert';
      this.app.showToast(`❌ ${errorMsg}`, 'error');
    } finally {
      this.isAlertProcessing = false;
      this.app.showSpinner(false);
    }
  }

  /**
   * Cancel a pending alert
   */
  async handleCancelAlert(alertId) {
    try {
      await api.request(`/alerts/${alertId}/cancel`, { method: 'POST' });
      await this.loadAlerts();
      this.app.showToast('Buy limit order cancelled', 'success');
    } catch (error) {
      console.error('Cancel alert error:', error);
      const errorMsg = error.message || 'Failed to cancel alert';
      this.app.showToast(`❌ ${errorMsg}`, 'error');
    }
  }

  /**
   * Handle buy form submission
   */
  async handleBuySubmit(event) {
    event.preventDefault();

    if (!this.selectedCoin || !this.currentPrice) {
      this.app.showToast('Please select a coin first', 'error');
      return;
    }

    const quantityInput = document.getElementById('buy-quantity');
    const quantity = parseFloat(quantityInput.value);

    // Validation
    if (!quantity || quantity <= 0) {
      this.app.showToast('Please enter a valid quantity', 'error');
      return;
    }

    if (!Number.isFinite(quantity)) {
      this.app.showToast('Quantity must be a valid number', 'error');
      return;
    }

    // Prevent double submission
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      this.app.showSpinner(true);

      const tradeData = {
        symbol: this.selectedCoin,
        quantity: quantity
      };

      console.log('Executing buy trade:', tradeData);

      // Call backend API
      const response = await api.request('/trades/buy', {
        method: 'POST',
        body: tradeData
      });

      console.log('Buy trade response:', response);

      // Update local cache
      if (this.app.trades) {
        this.app.trades.unshift({
          type: 'buy',
          coin: this.selectedCoin,
          quantity: quantity,
          price_per_unit: this.currentPrice,
          total: quantity * this.currentPrice,
          created_at: new Date().toISOString()
        });
      }

      // Update holdings in app cache
      if (this.app.holdings) {
        if (this.app.holdings.has(this.selectedCoin)) {
          const holding = this.app.holdings.get(this.selectedCoin);
          holding.quantity += quantity;
          holding.cost_basis = (holding.cost_basis || 0) + (quantity * this.currentPrice);
        } else {
          this.app.holdings.set(this.selectedCoin, {
            coin: this.selectedCoin,
            quantity: quantity,
            cost_basis: quantity * this.currentPrice
          });
        }
        this.userHoldings = new Map(this.app.holdings);
      }

      // Refresh sell form's available balance now that holdings changed
      this.updateSellMaxQuantity();
      this.updateSellSummary();

      // Show success message
      this.app.showToast(
        `✅ Successfully bought ${quantity.toFixed(6)} ${this.selectedCoin.toUpperCase()}`,
        'success'
      );

      // Display transaction details
      this.displayTransactionDetails('buy', response);

      // Reset form
      document.getElementById('buy-form').reset();
      document.getElementById('buy-total-cost').textContent = '$0.00';

    } catch (error) {
      console.error('Buy trade error:', error);
      const errorMsg = error.message || 'Failed to execute buy trade';
      this.app.showToast(`❌ ${errorMsg}`, 'error');
    } finally {
      this.isProcessing = false;
      this.app.showSpinner(false);
    }
  }

  /**
   * Handle sell form submission
   */
  async handleSellSubmit(event) {
    event.preventDefault();

    if (!this.selectedCoin || !this.currentPrice) {
      this.app.showToast('Please select a coin first', 'error');
      return;
    }

    const quantityInput = document.getElementById('sell-quantity');
    const quantity = parseFloat(quantityInput.value);
    const maxQuantity = this.userHoldings.get(this.selectedCoin)?.quantity || 0;

    // Validation
    if (!quantity || quantity <= 0) {
      this.app.showToast('Please enter a valid quantity', 'error');
      return;
    }

    if (quantity > maxQuantity) {
      this.app.showToast(
        `You only have ${maxQuantity.toFixed(6)} ${this.selectedCoin.toUpperCase()} to sell`,
        'error'
      );
      return;
    }

    if (!Number.isFinite(quantity)) {
      this.app.showToast('Quantity must be a valid number', 'error');
      return;
    }

    // Prevent double submission
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      this.app.showSpinner(true);

      const tradeData = {
        symbol: this.selectedCoin,
        quantity: quantity
      };

      console.log('Executing sell trade:', tradeData);

      // Call backend API
      const response = await api.request('/trades/sell', {
        method: 'POST',
        body: tradeData
      });

      console.log('Sell trade response:', response);

      // Update local cache
      if (this.app.trades) {
        this.app.trades.unshift({
          type: 'sell',
          coin: this.selectedCoin,
          quantity: quantity,
          price_per_unit: this.currentPrice,
          total: quantity * this.currentPrice,
          created_at: new Date().toISOString()
        });
      }

      // Update holdings in app cache
      if (this.app.holdings && this.app.holdings.has(this.selectedCoin)) {
        const holding = this.app.holdings.get(this.selectedCoin);
        holding.quantity -= quantity;

        if (holding.quantity <= 0) {
          this.app.holdings.delete(this.selectedCoin);
        } else {
          // Update cost basis proportionally
          const proportionalCostBasis = (holding.cost_basis || 0) * (quantity / (holding.quantity + quantity));
          holding.cost_basis = (holding.cost_basis || 0) - proportionalCostBasis;
        }

        this.userHoldings = new Map(this.app.holdings);
      }

      // Show success message
      this.app.showToast(
        `✅ Successfully sold ${quantity.toFixed(6)} ${this.selectedCoin.toUpperCase()}`,
        'success'
      );

      // Display transaction details
      this.displayTransactionDetails('sell', response);

      // Reset form
      document.getElementById('sell-form').reset();
      document.getElementById('sell-total-proceeds').textContent = '$0.00';
      this.updateSellMaxQuantity();

    } catch (error) {
      console.error('Sell trade error:', error);
      const errorMsg = error.message || 'Failed to execute sell trade';
      this.app.showToast(`❌ ${errorMsg}`, 'error');
    } finally {
      this.isProcessing = false;
      this.app.showSpinner(false);
    }
  }

  /**
   * Display transaction details in UI
   */
  displayTransactionDetails(type, response) {
    const detailsContainer = document.getElementById('transaction-details');
    if (!detailsContainer) return;

    const tradeType = type.toUpperCase();
    const symbol = response.symbol?.toUpperCase() || this.selectedCoin.toUpperCase();
    const quantity = response.quantity || 0;
    const unitPrice = response.unit_price || this.currentPrice;
    const totalValue = response.total_value || quantity * unitPrice;

    const html = `
      <div class="transaction-card">
        <div class="transaction-header">
          <h4>${tradeType} Order Executed</h4>
          <span class="transaction-type ${type}">${tradeType}</span>
        </div>
        <div class="transaction-body">
          <div class="detail-row">
            <span class="detail-label">Cryptocurrency:</span>
            <span class="detail-value">${symbol}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Quantity:</span>
            <span class="detail-value">${CryptoPulseAPI.formatNumber(quantity)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Price per Unit:</span>
            <span class="detail-value">${CryptoPulseAPI.formatCurrency(unitPrice)}</span>
          </div>
          <div class="detail-row total">
            <span class="detail-label">Total ${type === 'buy' ? 'Cost' : 'Proceeds'}:</span>
            <span class="detail-value">${CryptoPulseAPI.formatCurrency(totalValue)}</span>
          </div>
        </div>
      </div>
    `;

    detailsContainer.innerHTML = html;
  }

  /**
   * Handle document click to close dropdown
   */
  handleDocumentClick(event) {
    const coinSearch = document.getElementById('coin-search');
    const coinDropdown = document.getElementById('coin-dropdown');

    if (!coinSearch || !coinDropdown) return;

    if (!coinSearch.contains(event.target) && !coinDropdown.contains(event.target)) {
      coinDropdown.classList.remove('show');
    }
  }

  /**
   * Render the trade page
   */
  async render() {
    await this.init();

    // Setup document click listener for dropdown
    document.addEventListener('click', (e) => this.handleDocumentClick(e));
  }
}
