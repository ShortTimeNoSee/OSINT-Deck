<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import Fuse from 'fuse.js';
  import NavPanel from './components/NavPanel.svelte';
  import ResourceGrid from './components/ResourceGrid.svelte';
  import Breadcrumb from './components/Breadcrumb.svelte';

  let data = null;
  let currentPath = [];
  let searchTerm = "";
  let filteredItems = [];
  let fuseInstance = null;
  let allItemsFlattened = [];

  let isMobileNavOpen = false;
  let isReportModalOpen = false;
  let isSuggestModalOpen = false;

  let itemToReport = null;
  let reportContext = '';
  let isReporting = false;
  let reportMessage = '';

  let suggestionName = '';
  let suggestionUrl = '';
  let suggestionDescription = '';
  let suggestionTags = '';
  let isSubmittingSuggestion = false;
  let suggestionMessage = '';
  let suggestionStatus = '';
  let suggestionTimeout;

  let suggestModalElement;
  let reportModalElement;
  let headerElement;

  let headerHeight = 60;
  let resizeObserver;

  let activeFilters = {
    cost: [],
    platform: [],
    tags: [],
    login_required: []
  };

  $: currentItems = (() => {
    if (!data) return [];
    if (searchTerm.trim().length >= 2 && fuseInstance) {
      return searchResources(searchTerm);
    }
    const currentCategory = currentPath.length === 0 ? data : currentPath[currentPath.length - 1];
    return currentCategory?.children || [];
  })();

  $: activeFilterState = {
    cost: activeFilters.cost,
    platform: activeFilters.platform,
    tags: activeFilters.tags,
    login_required: activeFilters.login_required
  };

  $: filteredItems = (() => {
    const _ = activeFilterState;
    return applyFilters(currentItems);
  })();

  $: hasActiveFilters = Object.values(activeFilters).some(filters => filters.length > 0);

  function clearAllFilters() {
    activeFilters = {
      cost: [],
      platform: [],
      tags: [],
      login_required: []
    };
  }

  function updateHeaderHeight() {
      if (headerElement && typeof window !== 'undefined' && window.innerWidth <= 768) {
          const newHeight = headerElement.offsetHeight;
          if (newHeight > 0 && newHeight !== headerHeight) {
              headerHeight = newHeight;
              document.documentElement.style.setProperty('--header-height', `${headerHeight}px`);
          }
      } else if (typeof window !== 'undefined' && window.innerWidth > 768) {
           document.documentElement.style.setProperty('--header-height', `0px`);
      }
  }

  async function loadData() {
    try {
      const response = await fetch('/resources.json');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const jsonData = await response.json();
      data = jsonData;
      allItemsFlattened = flattenData(data);
      initializeFuse(allItemsFlattened);
    } catch (err) {
      console.error("Error loading or parsing resources.json:", err);
      data = { name: "Error", type: "folder", children: [] };
      allItemsFlattened = [];
      initializeFuse([]);
    }
  }

  function flattenData(node, path = [], flatList = []) {
    const currentItemPath = [...path, node];
    if (path.length > 0 || node.type) {
      flatList.push({ node: node, path: currentItemPath });
    }
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => flattenData(child, currentItemPath, flatList));
    }
    return flatList;
  }

  function initializeFuse(list) {
    const options = {
      keys: [ { name: 'node.name', weight: 0.6 }, { name: 'node.tags', weight: 0.3 }, { name: 'node.description', weight: 0.1 } ],
      includeScore: true, includeMatches: true, threshold: 0.4, location: 0, distance: 100, minMatchCharLength: 2, ignoreLocation: false,
    };
    fuseInstance = new Fuse(list, options);
  }

  function normalizeUrl(url) {
    try {
      let parsed = new URL(url, 'http://dummy');
      let host = parsed.hostname.toLowerCase();
      let pathname = decodeURIComponent(parsed.pathname).replace(/\/+$/, '');
      let search = decodeURIComponent(parsed.search);
      return `${host}${pathname}${search}`;
    } catch (e) {
      return decodeURIComponent(url.replace(/^https?:\/\//i, '').replace(/\/+$/, ''));
    }
  }

  function searchResources(term) {
    if (!fuseInstance || term.trim().length < 2) return [];
    const results = fuseInstance.search(term.trim());
    
    const seenUrls = new Set();
    
    const deduplicatedResults = results.filter(result => {
      const node = result.item.node || result.item;
      if (node.type !== 'url' || !node.url) return true;
      const norm = normalizeUrl(node.url);
      if (seenUrls.has(norm)) {
        return false;
      }
      seenUrls.add(norm);
      return true;
    });
    
    return deduplicatedResults.map(result => result.item);
  }

  function applyFilters(items) {
    if (!items) return [];
    
    const hasActiveFilters = Object.values(activeFilters).some(filters => filters.length > 0);
    if (!hasActiveFilters) return items;
    
    return items.filter(item => {
      if (item.node) item = item.node;
      if (item.type === 'folder') return true;
        
      const matchesCost = activeFilters.cost.length === 0 || 
        (item.cost && activeFilters.cost.includes(item.cost.toLowerCase()));
        
      const matchesPlatform = activeFilters.platform.length === 0 || 
        (item.platform && activeFilters.platform.includes(item.platform.toLowerCase()));
        
      const matchesTags = activeFilters.tags.length === 0 || 
        (item.tags && activeFilters.tags.some(tag => item.tags.includes(tag)));

      const matchesLoginRequired = activeFilters.login_required.length === 0 || 
        activeFilters.login_required.some(filter => {
          if (filter.toLowerCase() === 'yes') {
            return item.login_required === true || item.login_required === 'yes' || item.login_required === 'y';
          } else {
            return !item.login_required || item.login_required === false || item.login_required === 'no' || item.login_required === 'n';
          }
        });
        
      return matchesCost && matchesPlatform && matchesTags && matchesLoginRequired;
    });
  }

  function navigateToCategory(categoryNode) {
    currentPath = [...currentPath, categoryNode];
    searchTerm = "";
    isMobileNavOpen = false;
  }

  function navigateBack(index) {
    currentPath = index === -1 ? [] : currentPath.slice(0, index + 1);
    searchTerm = "";
    isMobileNavOpen = false;
  }

  function handleResourceClick(item) {
    if (!item || !item.node) return;
    if (item.node.type === "folder") {
      currentPath = (searchTerm.trim().length >= 2 && item.path) ? item.path.slice(1) : [...currentPath, item.node];
      searchTerm = "";
      isMobileNavOpen = false;
    } else if (item.node.type === "url") {
      window.open(item.node.url, "_blank", "noopener,noreferrer");
    }
  }

  function handleSearchInput(event) { searchTerm = event.detail; }
  function handleClearSearch() { searchTerm = ""; }
  function handleCopyUrl(event) {
    const url = event.detail;
    if (navigator.clipboard && url) {
      navigator.clipboard.writeText(url).catch(err => console.error('Copy failed:', err));
    } else { console.warn('Clipboard unavailable or URL missing.'); }
  }

  function toggleMobileNav() { isMobileNavOpen = !isMobileNavOpen; }
  function closeMobileNav() { if (isMobileNavOpen) isMobileNavOpen = false; }

  async function focusFirstElement(modalElement) {
    await tick();
    if (!modalElement) return;
    const focusable = modalElement.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable) focusable.focus();
  }

  function openReportModal(event) {
    itemToReport = event.detail; reportMessage = ''; reportContext = '';
    isReportModalOpen = true; isMobileNavOpen = false;
    focusFirstElement(reportModalElement);
  }
  function closeReportModal() {
    isReportModalOpen = false; itemToReport = null; reportContext = ''; isReporting = false;
  }
  async function submitReport() {
    if (!itemToReport || isReporting) return;
    isReporting = true; reportMessage = '';
    const reportData = {
      reportedItemName: itemToReport.node.name,
      reportedItemUrl: itemToReport.node.url || null,
      reportedItemPath: itemToReport.path ? itemToReport.path.map(p => p.name).join(' / ') : itemToReport.node.name,
      reportContext: reportContext,
      timestamp: new Date().toISOString(),
    };
    try {
      const workerUrl = 'https://osint-deck-backend.theedenwatcher.workers.dev/report';
      const response = await fetch(workerUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reportData) });
      if (!response.ok) throw new Error(await response.text() || `Report failed: ${response.statusText}`);
      reportMessage = 'Report submitted successfully. Thank you!';
      setTimeout(closeReportModal, 2500);
    } catch (error) {
      console.error('Error submitting report:', error);
      reportMessage = `Error: ${error.message || 'Could not submit report.'}`;
      isReporting = false;
    }
  }

  function openSuggestModal() {
    suggestionName = ''; suggestionUrl = ''; suggestionDescription = ''; suggestionTags = '';
    suggestionMessage = ''; suggestionStatus = ''; isSubmittingSuggestion = false;
    isSuggestModalOpen = true; isMobileNavOpen = false;
    focusFirstElement(suggestModalElement);
  }
  function closeSuggestModal() { isSuggestModalOpen = false; }
  async function handleSuggestionSubmit() {
    if (isSubmittingSuggestion) return;
    isSubmittingSuggestion = true; suggestionMessage = 'Submitting...'; suggestionStatus = '';
    clearTimeout(suggestionTimeout);
    const tagsArray = suggestionTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    const formData = { name: suggestionName, url: suggestionUrl, description: suggestionDescription, tags: tagsArray, timestamp: new Date().toISOString() };
    try {
      const workerUrl = 'https://osint-deck-backend.theedenwatcher.workers.dev/suggest';
      const response = await fetch(workerUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      if (!response.ok) throw new Error(await response.text() || `Suggestion failed: ${response.statusText}`);
      suggestionMessage = 'Suggestion submitted successfully. Thank you!'; suggestionStatus = 'success';
      setTimeout(closeSuggestModal, 2500);
    } catch (error) {
      console.error('Error submitting suggestion:', error);
      suggestionMessage = `Error: ${error.message || 'Could not submit suggestion.'}`; suggestionStatus = 'error';
      isSubmittingSuggestion = false;
    } finally {
      if (suggestionStatus !== 'success') {
        suggestionTimeout = setTimeout(() => { suggestionMessage = ''; suggestionStatus = ''; }, 5000);
      }
    }
  }

  function handleFilterChange(event) {
    activeFilters = event.detail;
  }

  onMount(() => {
    loadData();
    if (typeof window !== 'undefined') {
      tick().then(updateHeaderHeight);
      if (headerElement && 'ResizeObserver' in window) {
        resizeObserver = new ResizeObserver(() => {
          updateHeaderHeight();
        });
        resizeObserver.observe(headerElement);
      } else {
         window.addEventListener('resize', updateHeaderHeight);
      }
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
         window.removeEventListener('resize', updateHeaderHeight);
      }
    }
  });
</script>

<svelte:window on:resize={updateHeaderHeight}/>

<div class="app-container">
  <header class="app-header" bind:this={headerElement}>
    <button class="hamburger-button" on:click={toggleMobileNav} aria-label="Toggle navigation" aria-expanded={isMobileNavOpen}>
      <i class="fas {isMobileNavOpen ? 'fa-times' : 'fa-bars'}"></i>
    </button>
    <div class="mobile-search-container search-container">
      <i class="fas fa-search search-icon"></i>
      <input type="text" class="search-input" placeholder="Search resources..." bind:value={searchTerm} on:input={() => handleSearchInput({ detail: searchTerm })} aria-label="Search Resources (Mobile)" />
      <button class="clear-button" class:visible={searchTerm.length > 0} on:click={handleClearSearch} aria-label="Clear search">&times;</button>
    </div>
  </header>

  <NavPanel 
    bind:isMobileOpen={isMobileNavOpen} 
    {activeFilters}
    on:search={handleSearchInput} 
    on:clearSearch={handleClearSearch} 
    on:openSuggestModal={openSuggestModal}
    on:filterChange={handleFilterChange} />

   <div class="nav-overlay" class:active={isMobileNavOpen} on:click={closeMobileNav} on:keydown={(e) => { if (e.key === 'Escape') closeMobileNav(); }} role="button" tabindex={isMobileNavOpen ? 0 : -1} aria-label="Close navigation" aria-hidden={!isMobileNavOpen}></div>

  <main class="resource-container" on:click={() => isMobileNavOpen && closeMobileNav()} on:keydown={(e) => { if (isMobileNavOpen && e.key === 'Escape') closeMobileNav(); }}>
    <Breadcrumb {currentPath} {searchTerm} on:navigate={(e) => navigateBack(e.detail)} />

    <div class="search-container desktop-search">
      <i class="fas fa-search search-icon"></i>
      <input type="text" class="search-input" placeholder="Search resources..." bind:value={searchTerm} on:input={() => handleSearchInput({ detail: searchTerm })} aria-label="Search Resources (Desktop)" />
      <button class="clear-button" class:visible={searchTerm.length > 0} on:click={handleClearSearch} aria-label="Clear search">&times;</button>
    </div>

    <ResourceGrid 
      {filteredItems} 
      {searchTerm} 
      {hasActiveFilters}
      unfilteredItems={currentItems}
      on:resourceClick={(e) => handleResourceClick(e.detail)} 
      on:copyUrl={handleCopyUrl} 
      on:openReportModal={openReportModal}
      on:clearFilters={clearAllFilters} />
  </main>

  <div class="modal-overlay" class:visible={isReportModalOpen} on:click={closeReportModal} on:keydown={(e) => { if (e.key === 'Escape') closeReportModal(); }} role="dialog" aria-modal="true" aria-labelledby="report-modal-title" tabindex="-1" aria-hidden={!isReportModalOpen} bind:this={reportModalElement}>
    <div class="modal-content" on:click|stopPropagation on:keydown={() => {}}>
      <div class="modal-header">
        <h3 id="report-modal-title">Report Item</h3>
        <button class="modal-close-button" on:click={closeReportModal} aria-label="Close report modal">&times;</button>
      </div>
      <div class="modal-body">
        {#if itemToReport}
          <p>Report this item as potentially broken, outdated, or inappropriate?</p>
          <p><strong>{itemToReport.node.name}</strong></p>
          {#if itemToReport.node.url}
            <p style="font-size: 0.85em; word-break: break-all;">URL: {itemToReport.node.url}</p>
          {/if}
          <div style="margin-top: 1rem;">
            <label for="report-context" style="display: block; margin-bottom: 0.25rem; font-size: 0.85rem; color: var(--text-muted);">Reason / Context (Max 500 Characters)</label>
            <textarea id="report-context" bind:value={reportContext} maxlength="500" placeholder="Provide details about why you are reporting this item. (Optional)" rows="3" style="width: 100%; resize: vertical;" class="suggestion-form-modal textarea"></textarea>
          </div>
          {#if reportMessage}
            <p class="submission-message {reportMessage.startsWith('Error:') ? 'error' : 'success'}" style="margin-top: 1rem;">{reportMessage}</p>
          {/if}
        {:else}
          <p>Loading item details...</p>
        {/if}
      </div>
      <div class="modal-footer">
        <button type="button" class="modal-button cancel" on:click={closeReportModal} disabled={isReporting}>Cancel</button>
        <button type="button" class="modal-button confirm danger" on:click={submitReport} disabled={isReporting || !itemToReport}> {#if isReporting}Reporting...{:else}Confirm Report{/if} </button>
      </div>
    </div>
  </div>

  <div class="modal-overlay" class:visible={isSuggestModalOpen} on:click={closeSuggestModal} on:keydown={(e) => { if (e.key === 'Escape') closeSuggestModal(); }} role="dialog" aria-modal="true" aria-labelledby="suggest-modal-title" tabindex="-1" aria-hidden={!isSuggestModalOpen} bind:this={suggestModalElement}>
    <div class="modal-content" on:click|stopPropagation on:keydown={() => {}}>
      <div class="modal-header">
        <h3 id="suggest-modal-title">Suggest a Resource</h3>
        <button class="modal-close-button" on:click={closeSuggestModal} aria-label="Close suggestion modal">&times;</button>
      </div>
      <form class="modal-body suggestion-form-modal" on:submit|preventDefault={handleSuggestionSubmit}>
        <label for="suggest-name">Name* (Max 100 Characters)</label>
        <input type="text" id="suggest-name" bind:value={suggestionName} required maxlength="100" placeholder="e.g., Awesome OSINT Tool">
        <label for="suggest-url">URL*</label>
        <input type="url" id="suggest-url" bind:value={suggestionUrl} required placeholder="https://example.com">
        <label for="suggest-desc">Description (Max 500 Characters)</label>
        <textarea id="suggest-desc" bind:value={suggestionDescription} maxlength="500" placeholder="What does this tool do? (Optional)" rows="4"></textarea>
        <label for="suggest-tags">Tags (Max 100 Characters)</label>
        <input type="text" id="suggest-tags" bind:value={suggestionTags} maxlength="100" placeholder="Comma-separated, e.g., social, free (Optional)">
        {#if suggestionMessage}
          <p class="submission-message {suggestionStatus}" style="margin-top: 0.5rem;">{suggestionMessage}</p>
        {/if}
        <div class="modal-footer" style="border-top: none; padding-top: 0.5rem; margin-top: 0.5rem;">
          <button type="button" class="modal-button cancel" on:click={closeSuggestModal} disabled={isSubmittingSuggestion}>Cancel</button>
          <button type="submit" class="modal-button confirm" disabled={isSubmittingSuggestion || !suggestionName || !suggestionUrl}> {#if isSubmittingSuggestion}Submitting...{:else}Submit Suggestion{/if} </button>
        </div>
      </form>
    </div>
  </div>
</div>

<style>
  @import "./app.css";

  .desktop-search { 
    display: block; 
    margin-bottom: 1.5rem; 
  }
  
  @media (max-width: 768px) { 
    .desktop-search { 
      display: none; 
    } 
  }

  .suggestion-form-modal.textarea {
    width: 100%;
    padding: 0.6rem 0.8rem;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid var(--border);
    border-radius: var(--border-radius);
    color: var(--text);
    font-size: 0.9rem;
    font-family: inherit;
    transition: var(--transition);
    min-height: 60px;
    resize: vertical;
  }

  .suggestion-form-modal.textarea:focus {
    border-color: var(--accent);
    outline: none;
    box-shadow: 0 0 0 3px rgba(114, 137, 218, 0.2);
    background: rgba(255, 255, 255, 0.1);
  }
</style>