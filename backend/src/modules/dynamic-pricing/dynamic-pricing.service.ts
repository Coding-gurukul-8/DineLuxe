export type DynamicPricingRecord = Record<string, unknown> & { id: string };

export async function list(): Promise<DynamicPricingRecord[]> {
  return [];
}

export async function create(
  payload: Record<string, unknown>
): Promise<DynamicPricingRecord> {
  return { id: 'temp', ...payload };
}

export async function getById(id: string): Promise<DynamicPricingRecord> {
  return { id };
}

export async function update(
  id: string,
  payload: Record<string, unknown>
): Promise<DynamicPricingRecord> {
  return { id, ...payload };
}

export async function remove(id: string): Promise<{ id: string; deleted: true }> {
  return { id, deleted: true };
}
