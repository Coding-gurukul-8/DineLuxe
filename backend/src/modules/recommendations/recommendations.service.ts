export type RecommendationRecord = Record<string, unknown> & { id: string };

export async function list(): Promise<RecommendationRecord[]> {
  return [];
}

export async function create(
  payload: Record<string, unknown>
): Promise<RecommendationRecord> {
  return { id: 'temp', ...payload };
}

export async function getById(id: string): Promise<RecommendationRecord> {
  return { id };
}

export async function update(
  id: string,
  payload: Record<string, unknown>
): Promise<RecommendationRecord> {
  return { id, ...payload };
}

export async function remove(id: string): Promise<{ id: string; deleted: true }> {
  return { id, deleted: true };
}
