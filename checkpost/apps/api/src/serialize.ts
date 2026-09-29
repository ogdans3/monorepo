import type { ChangeEvent, Item, List, Tag, TagColor } from '@checkpost/contract';
import type { ItemRow, ListEventRow, ListRow, TagRow } from './db/schema.js';

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
    tagIds: row.tagIds,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toTag(row: TagRow): Tag {
  return {
    id: row.id,
    listId: row.listId,
    name: row.name,
    // Only ever written from `tagColorSchema`, so the cast states a fact.
    color: row.color as TagColor,
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
