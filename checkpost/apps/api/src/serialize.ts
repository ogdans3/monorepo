import type { ChangeEvent, Item, List } from '@checkpost/contract';
import type { ItemRow, ListEventRow, ListRow } from './db/schema.js';

/**
 * One place where database rows become wire objects. Timestamps are always ISO
 * strings and `revision` is always a number, so the Dart client has exactly one
 * shape to parse.
 */

export function toList(row: ListRow): List {
  return {
    id: row.id,
    title: row.title,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    listId: row.listId,
    text: row.text,
    note: row.note,
    checked: row.checked,
    checkedAt: row.checkedAt ? row.checkedAt.toISOString() : null,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toChangeEvent(row: ListEventRow): ChangeEvent {
  return {
    type: row.type as ChangeEvent['type'],
    revision: row.revision,
    actor: row.actor,
    at: row.createdAt.toISOString(),
    data: row.data as Record<string, unknown>,
  };
}
