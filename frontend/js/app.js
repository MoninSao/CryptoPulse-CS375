/**
 * CryptoPulse App Main application initialization
 * Orchestrates router, API, WebSocket, and page rendering
 */

class CryptoPulseApp {
  constructor() {
    this.prices = new Map(); // Cache for current prices
    this.changes = new Map(); // Cache for 24h changes
    this.meta = new Map(); // Cache for coin display metadata (name/logo)
    this.holdings = new Map(); // Cache for holdings
    this.trades = []; // Cache for trades
    this.isInitialized = false;
    this.lastUpdateTime = null; // Track last update timestamp
    this.tradePage = null; // Trade page component instance
    this.portfolioPage = null; // Portfolio page component instance
    this.historyPage = null; // History page component instance
  }

  /**
   * Initialize the application
   */
  async init() {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   Initializing CryptoPulse...          ║');
    console.log('╚════════════════════════════════════════╝');

    try {
      // Check backend health
      console.log('🔍 Checking backend connection...');
      const isHealthy = await api.healthCheck();
      if (!isHealthy) {
        console.warn('⚠️  Backend health check failed, some features may not work');
        this.showToast('Backend connection failed', 'error');
      } else {
        console.log('✅ Backend is healthy');
      }

      // Register page components
      console.log('📄 Registering page components...');
      this.registerPageComponents();

      // Setup WebSocket listeners for live prices
      console.log('🔌 Setting up WebSocket connection...');
      this.setupWebSocketListeners();

      // Load initial data
      console.log('📊 Loading initial data...');
      await this.loadInitialData();

      // Setup event listeners
      console.log('🎯 Setting up event listeners...');
      this.setupEventListeners();

      this.isInitialized = true;
      console.log('✅ CryptoPulse initialized successfully!\n');
      console.log('📱 Frontend: http://localhost:3000');
      console.log('🔌 Backend API: http://localhost:4000/api');
      console.log('🌐 WebSocket: ws://localhost:4000/ws/prices\n');
    } catch (error) {
      console.error('❌ Failed to initialize CryptoPulse:', error);
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
    // Connect to WebSocket server
    priceWebSocket.connect().then(() => {
      console.log('✅ WebSocket connection established');
    }).catch((error) => {
      console.error('❌ WebSocket connection failed:', error);
    });

    // Listen for price updates
    priceWebSocket.on('prices', ({ prices, changes, meta, timestamp }) => {
      console.log('💰 Price update received:', Object.keys(prices).length, 'coins');
      this.prices = new Map(Object.entries(prices));
      this.changes = new Map(Object.entries(changes || {}));
      this.meta = new Map(Object.entries(meta || {}));
      this.lastUpdateTime = timestamp;
      this.updatePriceDisplays();
    });

    priceWebSocket.on('connected', () => {
      console.log('✅ WebSocket connected');
      this.showToast('Connected to price stream', 'success');
    });

    priceWebSocket.on('disconnected', () => {
      console.log('❌ WebSocket disconnected');
      this.showToast('Price stream disconnected', 'warning');
    });

    priceWebSocket.on('reconnect_failed', () => {
      console.error('❌ WebSocket reconnection failed');
      this.showToast('Failed to reconnect to price stream', 'error');
    });

    priceWebSocket.on('error', ({ error }) => {
      console.error('❌ WebSocket error:', error);
    });
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Note: Trade form listeners are handled by TradePage; history filters
    // and pagination are handled by HistoryPage.
  }

  /**
   * Load initial data
   */
  async loadInitialData() {
    try {
      this.showSpinner(true);

      // Load current prices with 24h changes
      const pricesData = await api.getPrices();
      if (pricesData) {
        this.prices = new Map(Object.entries(pricesData.prices || {}));
        this.changes = new Map(Object.entries(pricesData.changes || {}));
        this.meta = new Map(Object.entries(pricesData.meta || {}));
        this.lastUpdateTime = pricesData.timestamp;
      }

      // Load portfolio holdings (used by TradePage for sell-max validation;
      // the Portfolio page fetches its own richer copy with P&L on entry)
      const holdingsData = await api.getHoldings();
      if (holdingsData && Array.isArray(holdingsData.holdings)) {
        this.holdings = new Map(
          holdingsData.holdings.map(h => [h.symbol, {
            symbol: h.symbol,
            quantity: parseFloat(h.quantity),
            avg_cost_basis: parseFloat(h.avg_cost_basis)
          }])
        );
      }

      console.log('✅ Initial data loaded');
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

    // Get top 10 coins by market cap rank (unranked coins sort last)
    const sortedCoins = Array.from(this.prices.entries())
      .sort(([coinIdA], [coinIdB]) => {
        const rankA = this.meta.get(coinIdA)?.market_cap_rank ?? Infinity;
        const rankB = this.meta.get(coinIdB)?.market_cap_rank ?? Infinity;
        return rankA - rankB;
      })
      .slice(0, 10);

    sortedCoins.forEach(([coinId, price]) => {
      const change24h = this.changes.get(coinId) || 0;
      const changeClass = change24h >= 0 ? 'positive' : 'negative';
      const changeSymbol = change24h >= 0 ? '+' : '';
      const meta = this.meta.get(coinId);
      const coinName = meta?.name || coinId.toUpperCase();

      const card = document.createElement('div');
      card.className = 'market-card';
      card.innerHTML = `
        <div class="coin-header">
          <div class="coin-identity">
            ${meta?.image ? `<img class="coin-logo" src="${meta.image}" alt="${coinName}" onerror="this.remove()">` : ''}
            <div>
              <div class="coin-name">${coinName}</div>
              <div class="coin-symbol">${coinId.toLowerCase()}</div>
            </div>
          </div>
          <div class="coin-change ${changeClass}">
            ${changeSymbol}${change24h.toFixed(2)}%
          </div>
        </div>
        <div class="coin-price">$${this.formatNumber(price)}</div>
        <div class="coin-footer">
          <span class="coin-label">24h Change</span>
        </div>
        <button class="btn btn-primary btn-sm" data-coin="${coinId}">Trade</button>
      `;

      card.querySelector('button').addEventListener('click', () => {
        // Navigate to trade page
        router.navigateTo('trade').then(() => {
          // Auto-select the coin in the trade page
          if (this.tradePage) {
            this.tradePage.selectCoin(coinId);
          }
        });
      });

      container.appendChild(card);
    });

    // Update timestamp display
    this.updateTimestamp();
  }

  /**
   * Update timestamp display
   */
  updateTimestamp() {
    const timestampEl = document.getElementById('market-timestamp');
    if (timestampEl && this.lastUpdateTime) {
      const date = new Date(this.lastUpdateTime);
      timestampEl.textContent = `Last updated: ${date.toLocaleTimeString()}`;
    }
  }

  /**
   * Format number with commas
   */
  formatNumber(num) {
    if (num >= 1) {
      return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
      return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
    }
  }

  /**
   * Render portfolio page
   */
  async renderPortfolioPage() {
    // Initialize portfolio page component if not already done
    if (!this.portfolioPage) {
      this.portfolioPage = new PortfolioPage(this);
    }

    // Render the portfolio page component
    await this.portfolioPage.render();
  }

  /**
   * Render trade page
   */
  async renderTradePage() {
    // Initialize trade page component if not already done
    if (!this.tradePage) {
      this.tradePage = new TradePage(this);
    }

    // Render the trade page component
    await this.tradePage.render();
  }

  /**
   * Render history page
   */
  async renderHistoryPage() {
    // Initialize history page component if not already done
    if (!this.historyPage) {
      this.historyPage = new HistoryPage(this);
    }

    // Render the history page component
    await this.historyPage.render();
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

    // Update portfolio page if visible (recompute from live prices, no re-fetch)
    if (router.getCurrentPage() === 'portfolio' && this.portfolioPage) {
      this.portfolioPage.onPriceUpdate();
    }

    // Update trade page price displays if trade page is instantiated
    if (this.tradePage && this.tradePage.selectedCoin) {
      this.tradePage.updatePriceDisplay();
      this.tradePage.updateBuySummary();
      this.tradePage.updateSellSummary();
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
