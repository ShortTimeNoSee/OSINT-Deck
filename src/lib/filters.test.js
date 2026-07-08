import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyFilters,
  folderHasMatchingDescendants,
  itemMatchesFilters,
} from './filters.js';

const emptyFilters = {
  cost: [],
  platform: [],
  tags: [],
  login_required: [],
};

const sampleTree = {
  type: 'folder',
  name: 'Root',
  children: [
    {
      type: 'folder',
      name: 'With matches',
      children: [
        {
          type: 'url',
          name: 'Freemium Web Tool',
          cost: 'Freemium',
          platform: 'web',
        },
      ],
    },
    {
      type: 'folder',
      name: 'Empty under filter',
      children: [
        {
          type: 'url',
          name: 'Paid CLI Tool',
          cost: 'Paid',
          platform: 'CLI',
        },
      ],
    },
    {
      type: 'url',
      name: 'Untagged Tool',
      url: 'https://example.com',
    },
  ],
};

test('items without metadata still match active filters', () => {
  const filters = { ...emptyFilters, cost: ['free'] };

  assert.equal(
    itemMatchesFilters({ type: 'url', name: 'No metadata' }, filters),
    true,
  );
  assert.equal(
    itemMatchesFilters({ type: 'url', name: 'Paid', cost: 'Paid' }, filters),
    false,
  );
});

test('platform matching is case insensitive', () => {
  const filters = { ...emptyFilters, platform: ['cli'] };

  assert.equal(
    itemMatchesFilters({ type: 'url', platform: 'CLI' }, filters),
    true,
  );
});

test('folderHasMatchingDescendants finds nested matches', () => {
  const filters = { ...emptyFilters, cost: ['freemium'] };
  const folder = sampleTree.children[0];

  assert.equal(folderHasMatchingDescendants(folder, filters), true);
  assert.equal(folderHasMatchingDescendants(sampleTree.children[1], filters), false);
});

test('applyFilters hides empty folders and keeps matching resources', () => {
  const filters = { ...emptyFilters, cost: ['freemium'] };
  const filtered = applyFilters(sampleTree.children, filters);

  assert.deepEqual(
    filtered.map((item) => item.name),
    ['With matches', 'Untagged Tool'],
  );
});

test('applyFilters returns all items when no filters are active', () => {
  assert.equal(applyFilters(sampleTree.children, emptyFilters).length, 3);
});
