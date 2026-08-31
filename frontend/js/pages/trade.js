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
  }

  /**
   * Initialize the trade page
   */
  async init() {
    this.setupEventListeners();
    await this.loadUserHoldings();
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

    // Filter coins based on search term
    const filteredCoins = Array.from(this.app.prices.entries())
      .filter(([coinId]) => coinId.toLowerCase().includes(searchTerm))
      .slice(0, 10); // Limit to 10 results

    if (filteredCoins.length === 0) {
      dropdown.innerHTML = '<div class="dropdown-item disabled">No coins found</div>';
      dropdown.classList.add('show');
      return;
    }

    filteredCoins.forEach(([coinId, price]) => {
      const change24h = this.app.changes.get(coinId) || 0;
      const changeClass = change24h >= 0 ? 'positive' : 'negative';
      const changeSymbol = change24h >= 0 ? '+' : '';

      const item = document.createElement('div');
      item.className = 'dropdown-item';
      item.dataset.coin = coinId;
      item.innerHTML = `
        <div class="dropdown-item-info">
          <span class="dropdown-item-name">${coinId.toUpperCase()}</span>
          <span class="dropdown-item-price">${CryptoPulseAPI.formatCurrency(price)}</span>
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
      nameDisplay.textContent = this.selectedCoin.toUpperCase();
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

    if (buyForm) {
      buyForm.reset();
      document.getElementById('buy-total-cost').textContent = '$0.00';
    }

    if (sellForm) {
      sellForm.reset();
      document.getElementById('sell-total-proceeds').textContent = '$0.00';
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
