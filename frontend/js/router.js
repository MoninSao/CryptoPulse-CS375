/**
 * CryptoPulse Router Client-side SPA routing without frameworks
 * Handles page navigation and history management
 */

class Router {
  constructor() {
    this.routes = new Map();
    this.currentPage = null;
    this.previousPage = null;
    this.isTransitioning = false;
    this.pageComponents = new Map();
  }

  // Register a route
  register(path, component) {
    this.routes.set(path, component);
  }

  // Register page component
  registerPageComponent(pageName, component) {
    this.pageComponents.set(pageName, component);
  }

  // Get route handler
  getRoute(path) {
    return this.routes.get(path) || null;
  }

  // Navigate to a page

  async navigateTo(pageName) {
    if (this.isTransitioning) return;

    // Get page element
    const pageElement = document.getElementById(`${pageName}-page`);
    if (!pageElement) {
      console.error(`Page not found: ${pageName}-page`);
      return;
    }

    // Check if page is already active
    if (this.currentPage === pageName) {
      return;
    }

    this.isTransitioning = true;

    try {
      // Hide current page
      if (this.currentPage) {
        const currentElement = document.getElementById(`${this.currentPage}-page`);
        if (currentElement) {
          currentElement.classList.remove('active');
        }
      }

      // Update active nav link
      this.updateActiveNavLink(pageName);

      // Get page component if registered
      const component = this.pageComponents.get(pageName);
      if (component && component.onEnter) {
        await component.onEnter();
      }

      // Show new page
      pageElement.classList.add('active');

      // Update history
      window.history.pushState({ page: pageName }, '', `#/${pageName}`);

      this.previousPage = this.currentPage;
      this.currentPage = pageName;

      console.log(`📄 Navigated to: ${pageName}`);
    } catch (error) {
      console.error(`Navigation error to ${pageName}:`, error);
    } finally {
      this.isTransitioning = false;
    }
  }

  // Update active navigation link
   
  updateActiveNavLink(pageName) {
    // Remove active from all links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });

    // Add active to current link
    const activeLink = document.querySelector(`[data-page="${pageName}"]`);
    if (activeLink) {
      activeLink.classList.add('active');
    }
  }

  // Initialize router
   
  init() {
    // Handle hash changes
    window.addEventListener('hashchange', () => {
      this.handleNavigation();
    });

    // Handle popstate for browser back/forward
    window.addEventListener('popstate', (event) => {
      if (event.state && event.state.page) {
        this.navigateTo(event.state.page);
      }
    });

    // Setup navigation link listeners
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const pageName = link.getAttribute('data-page');
        this.navigateTo(pageName);
      });
    });

    // Initial navigation
    this.handleNavigation();
  }

  // Handle navigation based on current hash
   
  handleNavigation() {
    const hash = window.location.hash.slice(1); // Remove #
    const pageName = hash.split('/')[1] || 'market'; // Default to market page

    // Validate page exists
    const pageElement = document.getElementById(`${pageName}-page`);
    if (pageElement) {
      this.navigateTo(pageName);
    } else {
      // Fallback to market if page doesn't exist
      this.navigateTo('market');
    }
  }

  // Get current page name
   
  getCurrentPage() {
    return this.currentPage;
  }

  // Get previous page name
   
  getPreviousPage() {
    return this.previousPage;
  }

  // Go back to previous page
   
  goBack() {
    window.history.back();
  }

  // Go forward to next page
   
  goForward() {
    window.history.forward();
  }
}

// Export router instance
const router = new Router();

// Initialize router when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  router.init();
});
