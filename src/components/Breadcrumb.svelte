<script>
  import { createEventDispatcher } from "svelte";

  export let currentPath = [];
  export let searchTerm = "";

  const dispatch = createEventDispatcher();

  function navigate(index) {
    if (searchTerm.trim() === "" && index === currentPath.length - 1) {
        return;
    }
    dispatch("navigate", index);
  }
</script>

<nav class="breadcrumb-trail" aria-label="breadcrumbs">
  <button type="button" class="breadcrumb-item is-link" on:click={() => navigate(-1)}>
    Home
  </button>

  {#if searchTerm.trim().length >= 2}
    <span class="breadcrumb-separator">/</span>
    <span class="breadcrumb-item is-current" aria-current="page">Search Results</span>
  {:else}
    {#each currentPath as category, index}
      <span class="breadcrumb-separator">/</span>
      {#if index === currentPath.length - 1}
        <span class="breadcrumb-item is-current" aria-current="page" title={category.name}>
           {category.name}
         </span>
      {:else}
        <button type="button" class="breadcrumb-item is-link" title={category.name} on:click={() => navigate(index)}>
          {category.name}
        </button>
      {/if}
    {/each}
  {/if}
</nav>

<style>
</style>