<script>
  import { createEventDispatcher } from "svelte";

  export let filteredItems = [];
  export let searchTerm = "";
  export let hasActiveFilters = false;
  export let unfilteredItems = [];

  const dispatch = createEventDispatcher();

  $: hasNonFolderItems = unfilteredItems.some(item => {
    const node = item.node || item;
    return node.type !== 'folder';
  });

  $: hasVisibleFolders = filteredItems.some(item => {
    const node = item.node || item;
    return node.type === 'folder';
  });

  $: showFilterMessage = hasActiveFilters && hasNonFolderItems && 
    (hasVisibleFolders || filteredItems.length === 0);

  function onCardClick(item) {
     const payload = item.node ? item : { node: item, path: null };
     dispatch("resourceClick", payload);
  }

  function handleCopy(event, url) {
      event.stopPropagation();
      dispatch("copyUrl", url);
  }

  function handleReport(event, item) {
      event.stopPropagation();
      const payload = item.node ? item : { node: item, path: null };
      dispatch("openReportModal", payload);
  }

  function handleExternalLink(event, url) {
      event.stopPropagation();
      window.open(url, "_blank", "noopener,noreferrer");
  }

  function highlight(text, term) {
        if (!term || !text) return text;
        try {
            const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(`(${escapedTerm})`, "gi");
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = text;
            const cleanText = tempDiv.textContent || tempDiv.innerText || '';
            return cleanText.replace(regex, '<span class="highlight">$1</span>');
        } catch (e) {
            console.warn("Highlight regex error:", e);
            return text;
        }
    }

    function formatDate(dateString) {
        if (!dateString) return null;
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        } catch (e) {
            return dateString;
        }
    }

    function getItemKey(item) {
        if (item.path && Array.isArray(item.path) && item.node) {
            const pathString = item.path.map(p => p?.name || '?').join('/');
            return `${pathString}::${item.node.name}::${item.node.url || ''}`;
        }
        else if (item.name) {
             return `${item.name}::${item.url || ''}`;
        }
        console.warn("Unexpected item structure for key generation:", item);
        return Math.random();
    }

</script>

<div class="resource-grid">
  {#each filteredItems as item (getItemKey(item))}
    {@const node = item.node || item}
    {@const path = item.path || null}
    {@const displayItem = { node: node, path: path }}

    <div
      class="resource-card"
      tabindex="0"
      role="button"
      aria-label="{node.name}{node.description ? `: ${node.description}` : ''}"
      on:click={() => onCardClick(displayItem)}
      on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && onCardClick(displayItem)}
     >
      <div class="resource-card-header">
           <span class="resource-card-icon {node.type}" aria-hidden="true">
                <i class="fas {node.type === 'folder' ? 'fa-folder' : 'fa-link'}"></i>
           </span>
           <h3 class="resource-card-title">
                {@html highlight(node.name, searchTerm)}
           </h3>
      </div>

      {#if node.description}
         <p class="resource-card-description">
            {@html highlight(node.description, searchTerm)}
         </p>
      {/if}

      <div class="resource-card-footer">
          <div class="resource-card-metadata">
              {#if node.cost}
                   <span class="metadata-badge cost-{node.cost.toLowerCase()}" title="Cost: {node.cost}">
                       <i class="fas {node.cost === 'free' ? 'fa-check-circle' : node.cost === 'paid' ? 'fa-dollar-sign' : 'fa-credit-card'}" aria-hidden="true"></i>
                       {node.cost}
                  </span>
              {/if}
              {#if node.login_required && (node.login_required === true || node.login_required === 'yes' || node.login_required === 'y')}
                   <span class="metadata-badge login-required" title="Login Required">
                       <i class="fas fa-user-lock" aria-hidden="true"></i>
                       Login Required
                  </span>
              {/if}
              {#if node.platform}
                   <span class="metadata-badge platform" title="Platform: {node.platform}">
                       <i class="fas {node.platform === 'web' ? 'fa-globe' : node.platform === 'api' ? 'fa-plug' : 'fa-desktop'}" aria-hidden="true"></i>
                       {node.platform}
                  </span>
              {/if}
              {#if node.tags && node.tags.length > 0}
                  {#each node.tags.slice(0, 3) as tag}
                       <span class="metadata-badge tag" title="Tag: {tag}">
                           <i class="fas fa-tag" aria-hidden="true"></i>
                           {@html highlight(tag, searchTerm)}
                       </span>
                   {/each}
                   {#if node.tags.length > 3}<span class="metadata-badge" aria-label="More tags">...</span>{/if}
              {/if}
              {#if node.last_checked}
                 <span class="metadata-badge date" title="Last Checked: {formatDate(node.last_checked)}">
                      <i class="fas fa-calendar-alt" aria-hidden="true"></i>
                      {formatDate(node.last_checked)}
                 </span>
              {/if}
          </div>

          <div class="resource-card-actions">
              {#if node.github}
                  {#if Array.isArray(node.github)}
                      {#each node.github as githubUrl}
                          <button
                            type="button"
                            class="card-action-button github-button"
                            title="View on GitHub"
                            aria-label="View {node.name} on GitHub"
                            on:click={(e) => handleExternalLink(e, githubUrl)}>
                              <i class="fab fa-github" aria-hidden="true"></i>
                          </button>
                      {/each}
                  {:else}
                      <button
                        type="button"
                        class="card-action-button github-button"
                        title="View on GitHub"
                        aria-label="View {node.name} on GitHub"
                        on:click={(e) => handleExternalLink(e, node.github)}>
                          <i class="fab fa-github" aria-hidden="true"></i>
                      </button>
                  {/if}
              {/if}
              {#if node.type === 'url'}
                  <button
                    type="button"
                    class="card-action-button copy-button"
                    title="Copy URL"
                    aria-label="Copy URL for {node.name}"
                    on:click={(e) => handleCopy(e, node.url)}>
                      <i class="fas fa-copy" aria-hidden="true"></i>
                  </button>
              {/if}
               <button
                  type="button"
                  class="card-action-button report-button"
                  title="Report this item"
                  aria-label="Report item {node.name}"
                  on:click={(e) => handleReport(e, displayItem)}>
                  <i class="fas fa-flag" aria-hidden="true"></i>
              </button>
          </div>
      </div>
    </div>
  {/each}

  {#if filteredItems.length === 0 && searchTerm.trim().length >= 2}
     <p style="color: var(--text-muted); grid-column: 1 / -1; text-align: center; margin-top: 2rem;">
         No results found for "{searchTerm}". Try different keywords?
     </p>
   {:else if filteredItems.every(item => (item.node || item).type === 'folder') && hasNonFolderItems && hasActiveFilters}
      <div style="color: var(--text-muted); grid-column: 1 / -1; text-align: center; margin-top: 2rem;">
        <p>There are no items matching your current filters.</p>
        <button 
          class="clear-filters-button" 
          on:click={() => dispatch('clearFilters')}
          style="background: none; border: none; color: var(--accent); text-decoration: underline; cursor: pointer; padding: 0.5rem; margin-top: 0.5rem; font: inherit;">
          Clear all filters
        </button>
      </div>
   {:else if filteredItems.length === 0}
      <div style="color: var(--text-muted); grid-column: 1 / -1; text-align: center; margin-top: 2rem;">
        <p>This folder is empty.</p>
      </div>
   {/if}

</div>

<style>
</style>