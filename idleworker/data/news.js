// News system for update notifications and changelogs
import { getAllVersions, VERSION_METADATA, ROADMAP } from './versions.js';

class NewsManager {
  constructor() {
    this.hasNewVersion = false;
    this.newsItems = [];
    this.loadedVersion = null;
  }

  async fetchNews() {
    try {
      // Try to load from JavaScript module first (preferred)
      try {
        const versions = getAllVersions();
        this.newsItems = [ROADMAP, ...versions];
        this.loadedVersion = 'module';
        return this.newsItems;
      } catch (moduleError) {
        console.warn('Failed to load versions from module, trying JSON fallback:', moduleError);
        
        // Fallback to JSON if module fails
        const response = await fetch('./data/news.json');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        this.newsItems = await response.json();
        this.loadedVersion = 'json';
        return this.newsItems;
      }
    } catch (error) {
      console.error('Failed to fetch news:', error);
      // Return minimal fallback data
      this.newsItems = [{
        id: 'error',
        title: 'Update System Unavailable',
        content: 'Unable to load update information at this time.',
        date: new Date().toISOString().split('T')[0],
        type: 'error'
      }];
      this.loadedVersion = 'fallback';
      return this.newsItems;
    }
  }

  getNewVersionInfo() {
    const settings = window.getAllSettings ? window.getAllSettings() : {};
    const lastKnownVersion = settings.lastKnownVersion || '0.20';
    
    // Check news items for newer versions
    const newerVersions = this.newsItems.filter(item => {
      if (item.type === 'roadmap' || item.id === 'roadmap') return false;
      
      // Support both id and version properties
      const itemVersion = item.id || item.version;
      if (!itemVersion) return false;
      
      const itemVersionNum = parseFloat(itemVersion);
      const lastVersionNum = parseFloat(lastKnownVersion);
      
      return !isNaN(itemVersionNum) && !isNaN(lastVersionNum) && itemVersionNum > lastVersionNum;
    });

    this.hasNewVersion = newerVersions.length > 0;
    
    if (this.hasNewVersion) {
      // Get the latest version
      const latestVersion = newerVersions.reduce((latest, current) => {
        const latestNum = parseFloat(latest.id || latest.version);
        const currentNum = parseFloat(current.id || current.version);
        return currentNum > latestNum ? current : latest;
      });
      
      return {
        hasNew: true,
        latestVersion: latestVersion.id || latestVersion.version,
        title: latestVersion.title,
        count: newerVersions.length,
        loadedFrom: this.loadedVersion
      };
    }
    
    return {
      hasNew: false,
      latestVersion: lastKnownVersion,
      loadedFrom: this.loadedVersion
    };
  }

  async checkForUpdates() {
    await this.fetchNews();
    return this.getNewVersionInfo();
  }

  markVersionAsSeen(version) {
    if (window.getAllSettings && window.saveSettings) {
      const settings = window.getAllSettings();
      settings.lastKnownVersion = version;
      window.saveSettings(settings);
    }
  }

  async showUpdateNotification() {
    const updateInfo = await this.checkForUpdates();
    
    if (updateInfo.hasNew) {
      // Auto-show news modal for new versions
      if (window.openNewsModal) {
        window.openNewsModal();
      }
      
      // Mark as seen after showing
      this.markVersionAsSeen(updateInfo.latestVersion);
      
      return true;
    }
    
    return false;
  }
}

// Create global instance
window.newsManager = new NewsManager();

// Export for module usage
export default window.newsManager;
