export type CustomerPreferenceRecord = Record<string, unknown> & { id: string };

export async function list(): Promise<CustomerPreferenceRecord[]> {
  return [];
}

export async function create(
  payload: Record<string, unknown>
): Promise<CustomerPreferenceRecord> {
  return { id: 'temp', ...payload };
}

export async function getById(id: string): Promise<CustomerPreferenceRecord> {
  return { id };
}

export async function update(
  id: string,
  payload: Record<string, unknown>
): Promise<CustomerPreferenceRecord> {
  return { id, ...payload };
}

export async function remove(id: string): Promise<{ id: string; deleted: true }> {
  return { id, deleted: true };
}
