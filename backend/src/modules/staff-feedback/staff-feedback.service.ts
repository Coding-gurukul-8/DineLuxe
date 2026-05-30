import { supabaseAdmin } from '../../config/supabase';
import { paginate, buildPaginationMeta } from '../../utils/pagination';

// ---------------------------------------------------------------------------
// Sentiment word lists (mirrors reviews.service.ts pattern, extended)
// ---------------------------------------------------------------------------
const POSITIVE_WORDS = [
  'great', 'excellent', 'amazing', 'love', 'happy', 'good',
  'wonderful', 'fantastic', 'best', 'perfect', 'awesome',
];
const NEGATIVE_WORDS = [
  'terrible', 'awful', 'bad', 'worst', 'hate', 'horrible',
  'unfair', 'toxic', 'bullying', 'abusive', 'threatening',
];

// ---------------------------------------------------------------------------
// Types — user_id is deliberately NEVER included in any return shape
// ---------------------------------------------------------------------------
export interface FeedbackItem {
  id: string;
  branch_id: string | null;
  role_label: string;
  feedback_text: string;
  sentiment_label: 'positive' | 'neutral' | 'negative' | null;
  sentiment_score: number | null;
  is_flagged: boolean;
  created_at: string;
}

export interface FeedbackListResult {
  items: FeedbackItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  positive_pct: number;
  neutral_pct: number;
  negative_pct: number;
  high_negative_branches: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function httpError(status: number, code: string, message: string): Error {
  return Object.assign(new Error(message), { status, code });
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Keyword-based sentiment — no external API, zero latency.
 * Returns label + a normalised score (0–1).
 */
function analyseSentiment(text: string): {
  label: 'positive' | 'neutral' | 'negative';
  score: number;
} {
  const words = text.toLowerCase().split(/\W+/).filter(Boolean);
  const posScore = words.filter((w) => POSITIVE_WORDS.includes(w)).length;
  const negScore = words.filter((w) => NEGATIVE_WORDS.includes(w)).length;

  const label: 'positive' | 'neutral' | 'negative' =
    posScore > negScore ? 'positive' : negScore > posScore ? 'negative' : 'neutral';
  const score = Math.abs(posScore - negScore) / (words.length || 1);

  return { label, score: Math.round(score * 1000) / 1000 };
}

/**
 * Computes the % breakdown and flags any branch_id where > 30% of entries
 * are negative (a signal for the owner to investigate).
 */
function buildSentimentStats(
  items: FeedbackItem[],
): Pick<FeedbackListResult, 'positive_pct' | 'neutral_pct' | 'negative_pct' | 'high_negative_branches'> {
  const total = items.length;
  if (total === 0) {
    return { positive_pct: 0, neutral_pct: 0, negative_pct: 0, high_negative_branches: [] };
  }

  let pos = 0, neu = 0, neg = 0;
  const branchNeg = new Map<string, number>();
  const branchTotal = new Map<string, number>();

  for (const item of items) {
    if (item.sentiment_label === 'positive') pos++;
    else if (item.sentiment_label === 'negative') neg++;
    else neu++;

    if (item.branch_id) {
      branchTotal.set(item.branch_id, (branchTotal.get(item.branch_id) ?? 0) + 1);
      if (item.sentiment_label === 'negative') {
        branchNeg.set(item.branch_id, (branchNeg.get(item.branch_id) ?? 0) + 1);
      }
    }
  }

  const high_negative_branches: string[] = [];
  for (const [bid, count] of branchTotal) {
    const negCount = branchNeg.get(bid) ?? 0;
    if (negCount / count > 0.3) high_negative_branches.push(bid);
  }

  const pct = (n: number) => Math.round((n / total) * 100);
  return {
    positive_pct: pct(pos),
    neutral_pct: pct(neu),
    negative_pct: pct(neg),
    high_negative_branches,
  };
}

// ---------------------------------------------------------------------------
// submitFeedback
// POST /staff-feedback
// ANONYMITY GUARANTEE: we store user_id internally but NEVER return it.
// ---------------------------------------------------------------------------
export async function submitFeedback(
  userId: string,
  restaurantId: string,
  branchId: string | undefined,
  role: string,
  feedbackText: string,
): Promise<{ message: string }> {
  const role_label = `A ${capitalise(role)}`;
  const { label, score } = analyseSentiment(feedbackText);

  const { error } = await supabaseAdmin.from('staff_feedback').insert({
    user_id: userId,          // stored for session-link audit only, never returned
    restaurant_id: restaurantId,
    branch_id: branchId ?? null,
    role_label,
    feedback_text: feedbackText,
    sentiment_label: label,
    sentiment_score: score,
    is_flagged: false,
  });

  if (error) throw error;

  // Return only the confirmation message — never echo back the record
  return { message: 'Feedback submitted anonymously' };
}

// ---------------------------------------------------------------------------
// getFeedbackForRestaurant
// GET /staff-feedback — owner sees their own restaurant's feedback
// ---------------------------------------------------------------------------
export async function getFeedbackForRestaurant(
  restaurantId: string,
  options: {
    branch_id?: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
    page: number;
    limit: number;
  },
): Promise<FeedbackListResult> {
  const { from, to } = paginate(options.page, options.limit);

  // SAFE SELECT — user_id is explicitly excluded
  let query = supabaseAdmin
    .from('staff_feedback')
    .select(
      'id, branch_id, role_label, feedback_text, sentiment_label, sentiment_score, is_flagged, created_at',
      { count: 'exact' },
    )
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (options.branch_id) query = query.eq('branch_id', options.branch_id);
  if (options.sentiment) query = query.eq('sentiment_label', options.sentiment);

  const { data, error, count } = await query;
  if (error) throw error;

  const items = (data ?? []) as FeedbackItem[];
  const stats = buildSentimentStats(items);
  const meta = buildPaginationMeta(count ?? 0, options.page, options.limit);

  return { items, total: meta.total, page: meta.page, limit: meta.limit, pages: meta.pages, ...stats };
}

// ---------------------------------------------------------------------------
// getFeedbackForAdmin
// GET /staff-feedback/admin — super_admin can query across all restaurants
// ---------------------------------------------------------------------------
export async function getFeedbackForAdmin(options: {
  restaurant_id?: string;
  branch_id?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  page: number;
  limit: number;
}): Promise<FeedbackListResult> {
  const { from, to } = paginate(options.page, options.limit);

  // SAFE SELECT — user_id is explicitly excluded
  let query = supabaseAdmin
    .from('staff_feedback')
    .select(
      'id, branch_id, role_label, feedback_text, sentiment_label, sentiment_score, is_flagged, created_at',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (options.restaurant_id) query = query.eq('restaurant_id', options.restaurant_id);
  if (options.branch_id) query = query.eq('branch_id', options.branch_id);
  if (options.sentiment) query = query.eq('sentiment_label', options.sentiment);

  const { data, error, count } = await query;
  if (error) throw error;

  const items = (data ?? []) as FeedbackItem[];
  const stats = buildSentimentStats(items);
  const meta = buildPaginationMeta(count ?? 0, options.page, options.limit);

  return { items, total: meta.total, page: meta.page, limit: meta.limit, pages: meta.pages, ...stats };
}

// ---------------------------------------------------------------------------
// flagFeedback
// PATCH /staff-feedback/:id/flag — owner or admin can flag for follow-up
// ---------------------------------------------------------------------------
export async function flagFeedback(
  feedbackId: string,
  restaurantId: string,
  isFlagged: boolean,
): Promise<FeedbackItem> {
  // Ownership check — restaurant owners can only flag their own feedback
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('staff_feedback')
    .select('id, restaurant_id')
    .eq('id', feedbackId)
    .single();

  if (fetchErr?.code === 'PGRST116' || !existing) {
    throw httpError(404, 'FEEDBACK_NOT_FOUND', 'Feedback entry not found.');
  }
  if (fetchErr) throw fetchErr;

  // Super admins bypass ownership check (handled in controller via role)
  // Here we enforce it for owners (restaurantId will be '' for super_admin path)
  if (restaurantId && (existing as any).restaurant_id !== restaurantId) {
    throw httpError(403, 'FORBIDDEN', 'You cannot flag feedback for another restaurant.');
  }

  // SAFE SELECT — user_id excluded
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('staff_feedback')
    .update({ is_flagged: isFlagged })
    .eq('id', feedbackId)
    .select(
      'id, branch_id, role_label, feedback_text, sentiment_label, sentiment_score, is_flagged, created_at',
    )
    .single();

  if (updateErr) throw updateErr;
  return updated as FeedbackItem;
}