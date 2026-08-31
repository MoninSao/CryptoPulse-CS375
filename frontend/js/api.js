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

  // Format currency
  static formatCurrency(value, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
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
