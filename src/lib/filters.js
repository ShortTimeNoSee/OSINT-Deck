export function getNode(item) {
  return item?.node ?? item;
}

export function hasActiveFilters(filters) {
  return Object.values(filters).some((values) => values.length > 0);
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function matchesLoginRequired(item, filters) {
  if (filters.login_required.length === 0) return true;

  const loginRequired = item.login_required;
  if (loginRequired === undefined || loginRequired === null) {
    return filters.login_required.includes('no');
  }

  return filters.login_required.some((filter) => {
    if (filter === 'yes') {
      return loginRequired === true || loginRequired === 'yes' || loginRequired === 'y';
    }

    return loginRequired === false || loginRequired === 'no' || loginRequired === 'n';
  });
}

export function itemMatchesFilters(item, filters) {
  if (!item || item.type === 'folder') return false;

  const matchesCost =
    filters.cost.length === 0 ||
    !item.cost ||
    filters.cost.includes(normalizeText(item.cost));

  const matchesPlatform =
    filters.platform.length === 0 ||
    !item.platform ||
    filters.platform.includes(normalizeText(item.platform));

  const itemTags = Array.isArray(item.tags)
    ? item.tags.map((tag) => normalizeText(tag))
    : [];

  const matchesTags =
    filters.tags.length === 0 ||
    itemTags.length === 0 ||
    filters.tags.some((tag) => itemTags.includes(normalizeText(tag)));

  return matchesCost && matchesPlatform && matchesTags && matchesLoginRequired(item, filters);
}

export function folderHasMatchingDescendants(folder, filters) {
  if (!folder?.children?.length) return false;

  return folder.children.some((child) => {
    if (child.type === 'folder') {
      return folderHasMatchingDescendants(child, filters);
    }

    return itemMatchesFilters(child, filters);
  });
}

export function applyFilters(items, filters) {
  if (!items) return [];
  if (!hasActiveFilters(filters)) return items;

  return items.filter((item) => {
    const node = getNode(item);

    if (node.type === 'folder') {
      return folderHasMatchingDescendants(node, filters);
    }

    return itemMatchesFilters(node, filters);
  });
}
