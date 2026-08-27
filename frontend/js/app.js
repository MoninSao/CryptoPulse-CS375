/**
 * CryptoPulse App Main application initialization
 * Orchestrates router, API, WebSocket, and page rendering
 */

class CryptoPulseApp {
  constructor() {
    this.prices = new Map(); // Cache for current prices
    this.holdings = new Map(); // Cache for holdings
    this.trades = []; // Cache for trades
    this.isInitialized = false;
  }

  /**
   * Initialize the application
   */
  async init() {
    console.log(' Initializing CryptoPulse...');

    try {
      // Check backend health
      const isHealthy = await api.healthCheck();
      if (!isHealthy) {
        console.warn(' Backend health check failed, some features may not work');
        this.showToast('Backend connection failed', 'error');
      }

      // Register page components
      this.registerPageComponents();

      // Setup WebSocket listeners for live prices
      this.setupWebSocketListeners();

      // Load initial data
      await this.loadInitialData();

      // Setup event listeners
      this.setupEventListeners();

      this.isInitialized = true;
      console.log(' CryptoPulse initialized successfully');
    } catch (error) {
      console.error('Failed to initialize CryptoPulse:', error);
      this.showToast('Initialization failed', 'error');
    }
  }

  /**
   * Register page components with router
   */
  registerPageComponents() {
    const marketPage = {
      onEnter: () => this.renderMarketPage()
    };

    const portfolioPage = {
      onEnter: () => this.renderPortfolioPage()
    };

    const tradePage = {
      onEnter: () => this.renderTradePage()
    };

    const historyPage = {
      onEnter: () => this.renderHistoryPage()
    };

    router.registerPageComponent('market', marketPage);
    router.registerPageComponent('portfolio', portfolioPage);
    router.registerPageComponent('trade', tradePage);
    router.registerPageComponent('history', historyPage);
  }

  /**
   * Setup WebSocket listeners
   */
  setupWebSocketListeners() {
    // Listen for price updates
    priceWebSocket.on('prices', ({ prices, timestamp }) => {
      console.log(' Price update received:', prices);
      this.prices = new Map(Object.entries(prices));
      this.updatePriceDisplays();
    });

    priceWebSocket.on('connected', () => {
      this.showToast('Connected to price stream', 'success');
    });

    priceWebSocket.on('disconnected', () => {
      this.showToast('Price stream disconnected', 'error');
    });

    priceWebSocket.on('reconnect_failed', () => {
      this.showToast('Failed to reconnect to price stream', 'error');
    });

    priceWebSocket.on('error', ({ error }) => {
      console.error('WebSocket error:', error);
    });
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Trade form submission
    const tradeForm = document.getElementById('trade-form');
    if (tradeForm) {
      tradeForm.addEventListener('submit', (e) => this.handleTradeSubmit(e));
    }

    // History filter
    const historyFilter = document.getElementById('history-filter');
    if (historyFilter) {
      historyFilter.addEventListener('change', (e) => {
        this.renderHistoryPage(e.target.value);
      });
    }

    // Coin select change
    const coinSelect = document.getElementById('coin-select');
    if (coinSelect) {
      coinSelect.addEventListener('change', (e) => this.updateCurrentPrice(e.target.value));
    }
  }

  /**
   * Load initial data
   */
  async loadInitialData() {
    try {
      this.showSpinner(true);

      // Load current prices
      const pricesData = await api.getPrices();
      if (pricesData) {
        this.prices = new Map(Object.entries(pricesData));
      }

      // Load portfolio holdings
      const holdings = await api.getHoldings();
      if (holdings && Array.isArray(holdings)) {
        holdings.forEach(holding => {
          this.holdings.set(holding.coin, holding);
        });
      }

      // Load trade history
      const trades = await api.getTrades();
      if (trades) {
        this.trades = Array.isArray(trades) ? trades : [];
      }

      console.log(' Initial data loaded');
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      this.showSpinner(false);
    }
  }

  /**
   * Render market page
   */
  async renderMarketPage() {
    const container = document.getElementById('market-grid');
    if (!container) return;

    container.innerHTML = '';

    if (this.prices.size === 0) {
      container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">Loading prices...</p>';
      return;
    }

    this.prices.forEach((price, coinId) => {
      const card = document.createElement('div');
      card.className = 'market-card';
      card.innerHTML = `
        <div class="coin-header">
          <div>
            <div class="coin-name">${coinId.toUpperCase()}</div>
            <div class="coin-symbol">${coinId}</div>
          </div>
        </div>
        <div class="coin-price">${CryptoPulseAPI.formatCurrency(price)}</div>
        <button class="btn btn-primary btn-sm" data-coin="${coinId}">View</button>
      `;

      card.querySelector('button').addEventListener('click', () => {
        document.getElementById('coin-select').value = coinId;
        this.updateCurrentPrice(coinId);
        router.navigateTo('trade');
      });

      container.appendChild(card);
    });
  }

  /**
   * Render portfolio page
   */
  async renderPortfolioPage() {
    // Update summary
    let totalValue = 0;
    let totalCostBasis = 0;

    this.holdings.forEach(holding => {
      const currentPrice = this.prices.get(holding.coin) || 0;
      const value = holding.quantity * currentPrice;
      const costBasis = holding.cost_basis || 0;

      totalValue += value;
      totalCostBasis += costBasis;
    });

    const gainLoss = totalValue - totalCostBasis;

    document.getElementById('total-value').textContent = CryptoPulseAPI.formatCurrency(totalValue);
    document.getElementById('total-cost-basis').textContent = CryptoPulseAPI.formatCurrency(totalCostBasis);
    document.getElementById('total-gain-loss').textContent = CryptoPulseAPI.formatCurrency(gainLoss);

    // Render holdings table
    const tbody = document.getElementById('holdings-tbody');
    if (tbody) {
      tbody.innerHTML = '';

      if (this.holdings.size === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">No holdings yet</td></tr>';
        return;
      }

      this.holdings.forEach(holding => {
        const currentPrice = this.prices.get(holding.coin) || 0;
        const value = holding.quantity * currentPrice;
        const costBasis = holding.cost_basis || 0;
        const holdingGainLoss = value - costBasis;
        const holdingGainLossPercent = costBasis > 0 ? (holdingGainLoss / costBasis) * 100 : 0;

        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${holding.coin.toUpperCase()}</td>
          <td>${CryptoPulseAPI.formatNumber(holding.quantity)}</td>
          <td>${CryptoPulseAPI.formatCurrency(currentPrice)}</td>
          <td>${CryptoPulseAPI.formatCurrency(value)}</td>
          <td>${CryptoPulseAPI.formatCurrency(costBasis)}</td>
          <td>
            <span class="price-change ${holdingGainLoss >= 0 ? 'positive' : 'negative'}">
              ${CryptoPulseAPI.formatCurrency(holdingGainLoss)} (${holdingGainLossPercent.toFixed(2)}%)
            </span>
          </td>
        `;
        tbody.appendChild(row);
      });
    }
  }

  /**
   * Render trade page
   */
  async renderTradePage() {
    const coinSelect = document.getElementById('coin-select');
    if (coinSelect && this.prices.size > 0) {
      const currentValue = coinSelect.value;
      const options = ['<option value="">Select a coin...</option>'];

      this.prices.forEach((price, coinId) => {
        options.push(`<option value="${coinId}" ${coinId === currentValue ? 'selected' : ''}>${coinId.toUpperCase()}</option>`);
      });

      coinSelect.innerHTML = options.join('');
    }

    if (coinSelect && coinSelect.value) {
      this.updateCurrentPrice(coinSelect.value);
    }
  }

  /**
   * Render history page
   */
  async renderHistoryPage(filter = null) {
    const tbody = document.getElementById('trades-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    let trades = this.trades;
    if (filter) {
      trades = trades.filter(t => t.type === filter);
    }

    if (trades.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">No trades yet</td></tr>';
      return;
    }

    trades.forEach(trade => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${CryptoPulseAPI.formatDate(trade.created_at)}</td>
        <td>
          <span class="price-change ${trade.type === 'buy' ? 'positive' : 'negative'}">
            ${trade.type.toUpperCase()}
          </span>
        </td>
        <td>${trade.coin.toUpperCase()}</td>
        <td>${CryptoPulseAPI.formatNumber(trade.quantity)}</td>
        <td>${CryptoPulseAPI.formatCurrency(trade.price_per_unit)}</td>
        <td>${CryptoPulseAPI.formatCurrency(trade.quantity * trade.price_per_unit)}</td>
      `;
      tbody.appendChild(row);
    });
  }

  /**
   * Update current price display
   */
  updateCurrentPrice(coinId) {
    const priceDisplay = document.getElementById('current-price');
    if (priceDisplay) {
      const price = this.prices.get(coinId);
      priceDisplay.textContent = price ? CryptoPulseAPI.formatCurrency(price) : '-';
    }
  }

  /**
   * Update price displays across pages
   */
  updatePriceDisplays() {
    // Update market page
    this.renderMarketPage();

    // Update portfolio page if visible
    if (router.getCurrentPage() === 'portfolio') {
      this.renderPortfolioPage();
    }

    // Update current price in trade form
    const coinSelect = document.getElementById('coin-select');
    if (coinSelect && coinSelect.value) {
      this.updateCurrentPrice(coinSelect.value);
    }
  }

  /**
   * Handle trade form submission
   */
  async handleTradeSubmit(event) {
    event.preventDefault();

    try {
      const coinSelect = document.getElementById('coin-select').value;
      const tradeType = document.querySelector('input[name="trade-type"]:checked').value;
      const amount = parseFloat(document.getElementById('amount').value);

      if (!coinSelect || !amount) {
        this.showToast('Please fill in all fields', 'error');
        return;
      }

      this.showSpinner(true);

      const price = this.prices.get(coinSelect) || 0;
      const quantity = amount / price;

      const tradeData = {
        coin: coinSelect,
        type: tradeType,
        quantity: quantity,
        price_per_unit: price,
        total: amount
      };

      // Create trade via API
      const result = await api.createTrade(tradeData);

      // Add to local cache
      this.trades.unshift(result);

      // Update holdings
      if (this.holdings.has(coinSelect)) {
        const holding = this.holdings.get(coinSelect);
        holding.quantity += quantity;
        holding.cost_basis += amount;
      } else {
        this.holdings.set(coinSelect, {
          coin: coinSelect,
          quantity: quantity,
          cost_basis: amount
        });
      }

      this.showToast(`${tradeType.toUpperCase()} order executed successfully!`, 'success');

      // Show transaction details
      const resultDiv = document.getElementById('trade-result');
      if (resultDiv) {
        resultDiv.textContent = JSON.stringify(result, null, 2);
      }

      // Reset form
      document.getElementById('trade-form').reset();
      this.updateCurrentPrice('');
    } catch (error) {
      console.error('Trade execution error:', error);
      this.showToast(`Error executing trade: ${error.message}`, 'error');
    } finally {
      this.showSpinner(false);
    }
  }

  /**
   * Show/hide spinner
   */
  showSpinner(show) {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
      if (show) {
        spinner.classList.remove('hidden');
      } else {
        spinner.classList.add('hidden');
      }
    }
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast show ${type}`;

    // Auto-hide after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new CryptoPulseApp();
  app.init();

  // Expose app globally for debugging
  window.cryptoPulseApp = app;
});
