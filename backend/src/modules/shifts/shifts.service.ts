export type ShiftRecord = Record<string, unknown> & { id: string };

export async function list(): Promise<ShiftRecord[]> {
  return [];
}

export async function create(payload: Record<string, unknown>): Promise<ShiftRecord> {
  return { id: 'temp', ...payload };
}

export async function getById(id: string): Promise<ShiftRecord> {
  return { id };
}

export async function update(
  id: string,
  payload: Record<string, unknown>
): Promise<ShiftRecord> {
  return { id, ...payload };
}

export async function remove(id: string): Promise<{ id: string; deleted: true }> {
  return { id, deleted: true };
}
