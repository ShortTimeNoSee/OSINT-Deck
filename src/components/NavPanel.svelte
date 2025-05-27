<script>
  import { createEventDispatcher, onMount } from "svelte";

  export let isMobileOpen = false;
  export let activeFilters = {
    status: [],
    cost: [],
    platform: [],
    tags: []
  };

  const dispatch = createEventDispatcher();

  const filterOptions = {
    status: ['Active', 'Deprecated'],
    cost: ['Free', 'Paid', 'Freemium', 'Login Required'],
    platform: ['Web', 'API', 'CLI'],
  };

  let isFiltersExpanded = false;

  function handleFilterChange(category, value) {
    const newFilters = { ...activeFilters };
    const index = newFilters[category].indexOf(value.toLowerCase());
    
    if (index === -1) {
      newFilters[category].push(value.toLowerCase());
    } else {
      newFilters[category].splice(index, 1);
    }
    
    dispatch('filterChange', newFilters);
  }

  function triggerOpenSuggestModal() {
    dispatch('openSuggestModal');
  }

  let trendingResources = [];
  let isTrendingLoading = false;
  let trendingError = null;

  async function loadTrendingResources() {
    try {
      isTrendingLoading = true;
      trendingError = null;
      const response = await fetch('https://osint-deck-backend.theedenwatcher.workers.dev/trending');
      if (!response.ok) throw new Error('Failed to fetch trending resources');
      trendingResources = await response.json();
    } catch (error) {
      console.error('Error loading trending resources:', error);
      trendingError = 'Unable to load trending resources';
    } finally {
      isTrendingLoading = false;
    }
  }

  async function handleResourceClick(resource) {
    try {
      await fetch('https://osint-deck-backend.theedenwatcher.workers.dev/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceId: resource.id,
          resourceName: resource.name,
          resourceUrl: resource.url
        })
      });
    } catch (error) {
      console.error('Error recording click:', error);
    }
    
    window.open(resource.url, "_blank", "noopener,noreferrer");
  }

  onMount(() => {
    loadTrendingResources();
    const interval = setInterval(loadTrendingResources, 300000);
    return () => clearInterval(interval);
  });

  function toggleFilters() {
    isFiltersExpanded = !isFiltersExpanded;
  }

  $: activeFilterCount = Object.values(activeFilters).reduce((sum, arr) => sum + arr.length, 0);
</script>

<aside class="nav-panel" class:active={isMobileOpen} aria-hidden={!isMobileOpen && typeof window !== 'undefined' && window.innerWidth <= 768}>
  <button type="button" class="suggest-button" on:click={triggerOpenSuggestModal}>
    <i class="fas fa-plus-circle"></i> Suggest a Resource
  </button>

  <div class="filters-section">
    <button 
      type="button" 
      class="filters-toggle" 
      on:click={toggleFilters}
      aria-expanded={isFiltersExpanded}
    >
      <div class="filters-toggle-content">
        <i class="fas fa-filter"></i>
        <span>Filters</span>
        {#if activeFilterCount > 0}
          <span class="filter-count">{activeFilterCount}</span>
        {/if}
      </div>
      <i class="fas fa-chevron-{isFiltersExpanded ? 'up' : 'down'}" aria-hidden="true"></i>
    </button>

    {#if isFiltersExpanded}
      <div class="filters-content" transition:slide>
        {#each Object.entries(filterOptions) as [category, options]}
          <div class="filter-group">
            <h3>{category}</h3>
            <div class="filter-options">
              {#each options as option}
                <label class="filter-option">
                  <input 
                    type="checkbox" 
                    checked={activeFilters[category.toLowerCase()].includes(option.toLowerCase())}
                    on:change={() => handleFilterChange(category.toLowerCase(), option)}
                  />
                  <span class="filter-label">
                    <i class="fas {
                      category === 'status' ? (option === 'Active' ? 'fa-check-circle' : 'fa-times-circle') :
                      category === 'cost' ? (option === 'Free' ? 'fa-check-circle' : option === 'Paid' ? 'fa-dollar-sign' : 'fa-credit-card') :
                      category === 'platform' ? (option === 'Web' ? 'fa-globe' : option === 'API' ? 'fa-plug' : 'fa-desktop') : ''
                    }"></i>
                    {option}
                  </span>
                </label>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="trending-section">
    <h2>Trending Resources</h2>
    {#if isTrendingLoading && !trendingResources.length}
      <p class="trending-placeholder">Loading trending resources...</p>
    {:else if trendingError}
      <p class="trending-placeholder">{trendingError}</p>
    {:else if trendingResources.length}
      <div class="trending-list">
        {#each trendingResources as resource}
          <button 
            class="trending-item" 
            on:click={() => handleResourceClick(resource)}
            title={resource.name}
          >
            <i class="fas fa-fire"></i>
            <span class="trending-name">{resource.name}</span>
            <span class="trending-count" title="{resource.count} views this week">{resource.count}</span>
          </button>
        {/each}
      </div>
    {:else}
      <p class="trending-placeholder">No trending resources yet</p>
    {/if}
  </div>
</aside>

<style>
  .nav-panel {
    scrollbar-width: none;
    -ms-overflow-style: none;
    overflow-y: auto;
  }

  .nav-panel::-webkit-scrollbar {
    display: none;
  }

  .filters-section {
    margin-top: 1rem;
    border-radius: var(--border-radius);
    background: rgba(255, 255, 255, 0.03);
  }

  .filters-toggle {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.8rem 1rem;
    background: none;
    border: none;
    color: var(--text);
    cursor: pointer;
    font-size: 0.95rem;
    font-weight: 500;
    transition: var(--transition);
  }

  .filters-toggle:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .filters-toggle-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .filter-count {
    background: var(--accent);
    color: white;
    padding: 0.1rem 0.4rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    min-width: 1.2rem;
    text-align: center;
  }

  .filters-content {
    padding: 0.5rem 1rem 1rem;
    border-top: 1px solid var(--border);
  }

  .filter-group {
    margin-top: 1rem;
  }

  .filter-group h3 {
    font-size: 0.85rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.5rem;
  }

  .filter-options {
    display: grid;
    gap: 0.4rem;
  }

  .filter-option {
    display: flex;
    align-items: center;
    cursor: pointer;
    color: var(--text-muted);
    font-size: 0.9rem;
    transition: var(--transition);
    padding: 0.3rem 0;
  }

  .filter-option:hover {
    color: var(--text);
  }

  .filter-option input {
    margin-right: 0.5rem;
  }

  .filter-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .filter-label i {
    font-size: var(--icon-size-small);
    width: 1em;
    text-align: center;
  }

  .trending-section {
    margin-top: 1.5rem;
  }

  .trending-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-top: 0.5rem;
  }

  .trending-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border);
    border-radius: var(--border-radius);
    color: var(--text);
    font-size: 0.9rem;
    cursor: pointer;
    transition: var(--transition);
    text-align: left;
    width: 100%;
  }

  .trending-item:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--accent);
  }

  .trending-item i {
    color: var(--warning);
    font-size: 0.8rem;
  }

  .trending-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .trending-count {
    background: rgba(255, 255, 255, 0.1);
    padding: 0.1rem 0.3rem;
    border-radius: 0.8rem;
    font-size: 0.75rem;
    min-width: 1.5rem;
    text-align: center;
    color: var(--text-muted);
  }

  .trending-placeholder {
    color: var(--text-muted);
    font-size: 0.9rem;
    font-style: italic;
  }
</style>

<script context="module">
  import { slide } from 'svelte/transition';
</script>