export type WasteLogRecord = Record<string, unknown> & { id: string };

export async function list(): Promise<WasteLogRecord[]> {
  return [];
}

export async function create(payload: Record<string, unknown>): Promise<WasteLogRecord> {
  return { id: 'temp', ...payload };
}

export async function getById(id: string): Promise<WasteLogRecord> {
  return { id };
}

export async function update(
  id: string,
  payload: Record<string, unknown>
): Promise<WasteLogRecord> {
  return { id, ...payload };
}

export async function remove(id: string): Promise<{ id: string; deleted: true }> {
  return { id, deleted: true };
}
