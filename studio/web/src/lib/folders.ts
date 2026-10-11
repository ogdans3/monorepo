import type { Row } from './api';

// Walk iteratively so folder depth is not limited by the JavaScript call stack.
export function folderTree(folders: Row[]) {
  const byID = new Map<string, Row>(folders.map((folder) => [folder.id, folder]));
  const children = new Map<string, Row[]>();
  for (const folder of folders) {
    const parent = byID.has(folder.parent_id) ? folder.parent_id : '';
    const siblings = children.get(parent) || [];
    siblings.push(folder);
    children.set(parent, siblings);
  }
  for (const siblings of children.values()) {
    siblings.sort((a, b) => a.name.localeCompare(b.name, 'nb') || a.id.localeCompare(b.id));
  }
  const paths = new Map<string, string>();
  const options: Row[] = [];
  const stack = (children.get('') || [])
    .slice()
    .reverse()
    .map((folder) => ({ folder, prefix: '' }));
  while (stack.length) {
    const { folder, prefix } = stack.pop()!;
    if (paths.has(folder.id)) continue;
    const path = prefix ? `${prefix} / ${folder.name}` : folder.name;
    paths.set(folder.id, path);
    options.push({ ...folder, path });
    const nested = children.get(folder.id) || [];
    for (let i = nested.length - 1; i >= 0; i--) stack.push({ folder: nested[i], prefix: path });
  }
  return { byID, children, paths, options };
}

export function folderTrail(tree: ReturnType<typeof folderTree>, id: string): Row[] {
  const trail: Row[] = [];
  const visited = new Set<string>();
  while (id && !visited.has(id)) {
    visited.add(id);
    const folder = tree.byID.get(id);
    if (!folder) break;
    trail.push(folder);
    id = folder.parent_id;
  }
  return trail.reverse();
}

export function folderDescendants(tree: ReturnType<typeof folderTree>, id: string): Set<string> {
  const ids = new Set<string>();
  const stack = id ? [id] : [];
  while (stack.length) {
    const next = stack.pop()!;
    if (ids.has(next)) continue;
    ids.add(next);
    for (const child of tree.children.get(next) || []) stack.push(child.id);
  }
  return ids;
}
