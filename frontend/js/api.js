/**
 * CryptoPulse, REST API wrapper for backend calls
 * Handles all HTTP requests to the backend API
 */

const API_BASE_URL = (typeof window !== 'undefined' && window.CRYPTOPULSE_CONFIG?.API_BASE_URL) 
  ? window.CRYPTOPULSE_CONFIG.API_BASE_URL 
  : 'http://localhost:4000/api';

class CryptoPulseAPI {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.timeout = 10000; // 10 second timeout
  }

  // Make HTTP request
  async request(endpoint, options = {}) {
    const {
      method = 'GET',
      body = null,
      headers = {},
      isJSON = true
    } = options;

    const url = `${this.baseURL}${endpoint}`;
    const fetchOptions = {
      method,
      headers: {
        'Content-Type': isJSON ? 'application/json' : 'application/x-www-form-urlencoded',
        ...headers
      }
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      fetchOptions.body = isJSON ? JSON.stringify(body) : new URLSearchParams(body);
    }

    try {
      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error [${method} ${endpoint}]:`, error);
      throw error;
    }
  }

  //  Prices 
  
  // Get current prices for all coins
  async getPrices() {
    return this.request('/prices');
  }

  // Get price for a specific coin
  async getPrice(coinId) {
    return this.request(`/prices/${coinId}`);
  }

  // Get price history for a coin
  async getPriceHistory(coinId, days = 7) {
    return this.request(`/prices/${coinId}/history?days=${days}`);
  }

  //  Portfolio 

  // Get portfolio overview
  async getPortfolio() {
    return this.request('/portfolio');
  }

  // Get all holdings
  async getHoldings() {
    return this.request('/portfolio/holdings');
  }

  // Get holdings for a specific coin
  async getHolding(coinId) {
    return this.request(`/portfolio/holdings/${coinId}`);
  }

  // Add holding
  async addHolding(data) {
    return this.request('/portfolio/holdings', {
      method: 'POST',
      body: data
    });
  }

  // Update holding
  async updateHolding(coinId, data) {
    return this.request(`/portfolio/holdings/${coinId}`, {
      method: 'PUT',
      body: data
    });
  }

  // Delete holding
  async deleteHolding(coinId) {
    return this.request(`/portfolio/holdings/${coinId}`, {
      method: 'DELETE'
    });
  }

  //  Trades 

  // Get all trades
  async getTrades(filter = null) {
    const query = filter ? `?type=${filter}` : '';
    return this.request(`/trades${query}`);
  }

  // Get paginated trade history with optional symbol/type/date-range filters
  async getTradeHistory(filters = {}) {
    const params = new URLSearchParams();
    if (filters.symbol) params.set('symbol', filters.symbol);
    if (filters.type) params.set('type', filters.type);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    if (filters.page) params.set('page', filters.page);
    if (filters.limit) params.set('limit', filters.limit);

    const query = params.toString();
    return this.request(`/trades/history${query ? `?${query}` : ''}`);
  }

  // Get trade by ID
  async getTrade(tradeId) {
    return this.request(`/trades/${tradeId}`);
  }

  // Create a new trade
  async createTrade(data) {
    return this.request('/trades', {
      method: 'POST',
      body: data
    });
  }

  // Update trade
  async updateTrade(tradeId, data) {
    return this.request(`/trades/${tradeId}`, {
      method: 'PUT',
      body: data
    });
  }

  // Delete trade
  async deleteTrade(tradeId) {
    return this.request(`/trades/${tradeId}`, {
      method: 'DELETE'
    });
  }

  //  Utility Methods 

  // Health check
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseURL.replace('/api', '')}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  // Pick decimal precision based on magnitude, so low-value coins
  // (e.g. SHIB at $0.00000813) don't round down to "$0.00"
  static getPriceDecimals(value) {
    const abs = Math.abs(value);
    if (abs === 0 || abs >= 1) return 2;
    if (abs >= 0.01) return 4;
    if (abs >= 0.0001) return 6;
    return 8;
  }

  // Format currency
  static formatCurrency(value, currency = 'USD') {
    const decimals = this.getPriceDecimals(value);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value);
  }

  // Format percentage
  static formatPercentage(value, decimals = 2) {
    return `${(value).toFixed(decimals)}%`;
  }

  // Format number
  static formatNumber(value, decimals = 2) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value);
  }

  // Format date
  static formatDate(date) {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  }
}

// Export API instance
const api = new CryptoPulseAPI();
