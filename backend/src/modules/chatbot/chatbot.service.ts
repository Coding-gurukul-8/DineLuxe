export type ChatbotRecord = Record<string, unknown> & { id: string };

export async function list(): Promise<ChatbotRecord[]> {
  return [];
}

export async function create(payload: Record<string, unknown>): Promise<ChatbotRecord> {
  return { id: 'temp', ...payload };
}

export async function getById(id: string): Promise<ChatbotRecord> {
  return { id };
}

export async function update(
  id: string,
  payload: Record<string, unknown>
): Promise<ChatbotRecord> {
  return { id, ...payload };
}

export async function remove(id: string): Promise<{ id: string; deleted: true }> {
  return { id, deleted: true };
}
