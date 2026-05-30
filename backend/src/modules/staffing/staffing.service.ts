export type StaffingRecord = Record<string, unknown> & { id: string };

export async function list(): Promise<StaffingRecord[]> {
  return [];
}

export async function create(payload: Record<string, unknown>): Promise<StaffingRecord> {
  return { id: 'temp', ...payload };
}

export async function getById(id: string): Promise<StaffingRecord> {
  return { id };
}

export async function update(
  id: string,
  payload: Record<string, unknown>
): Promise<StaffingRecord> {
  return { id, ...payload };
}

export async function remove(id: string): Promise<{ id: string; deleted: true }> {
  return { id, deleted: true };
}
