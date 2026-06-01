import { supabaseAdmin } from '../../config/supabase';
import { paginate } from '../../utils/pagination';
import { redis } from '../../config/redis';

const POSITIVE_WORDS = [
  'great', 'excellent', 'amazing', 'good', 'fantastic', 'delicious', 'love', 'perfect', 'wonderful', 'best',
  'tasty', 'friendly', 'fast', 'prompt', 'clean', 'cozy', 'fresh', 'recommend', 'yummy', 'pleasant', 'awesome',
  'satisfying', 'superb', 'impressive', 'stellar', 'outstanding'
];

const NEGATIVE_WORDS = [
  'bad', 'terrible', 'awful', 'horrible', 'disgusting', 'worst', 'poor', 'disappointing', 'slow', 'rude',
  'stale', 'cold', 'burnt', 'bland', 'undercooked', 'overcooked', 'dirty', 'smelly', 'late', 'noisy'
];

// ─── Create review ─────────────────────────────────────────────────────────────
export async function create(
  userId: string,
  payload: {
    order_id: string;
    restaurant_id: string;
    overall_rating: number;
    text_review?: string;
    item_ratings?: { order_item_id: string; rating: number }[];
    photos?: string[];
  }
) {
  // Validate: user must have a completed order at this restaurant
  // FIX: orders never reach 'completed' status; valid terminal statuses are 'paid', 'served', 'closed'
  const { data: order, error: orderErr } = await supabaseAdmin
    .from('orders')
    .select('id, status')
    .eq('id', payload.order_id)
    .eq('customer_id', userId)
    .in('status', ['paid', 'served', 'closed'])
    .single();

  if (orderErr || !order) {
    throw Object.assign(new Error('No completed order found for this user'), { statusCode: 422 });
  }

  // Check duplicate
  const { data: existing } = await supabaseAdmin
    .from('reviews')
    .select('id')
    .eq('order_id', payload.order_id)
    .eq('user_id', userId)
    .single();

  if (existing) {
    throw Object.assign(new Error('Review already submitted for this order'), { statusCode: 409 });
  }

  // Insert main review
  // FIX: fetch branch_id from order so getByBranch queries can filter correctly
  const { data: orderBranch } = await supabaseAdmin
    .from('orders')
    .select('branch_id')
    .eq('id', payload.order_id)
    .maybeSingle();

  const { data: review, error } = await supabaseAdmin
    .from('reviews')
    .insert({
      user_id: userId,
      order_id: payload.order_id,
      restaurant_id: payload.restaurant_id,
      branch_id: orderBranch?.branch_id ?? null,
      overall_rating: payload.overall_rating,
      text_review: payload.text_review ?? null,
      photos: payload.photos ?? [],
      sentiment_label: null,
      sentiment_score: null,
    })
    .select()
    .single();

  if (error) throw error;

  // Insert item-level ratings
  if (payload.item_ratings?.length) {
    const itemRatings = payload.item_ratings.map((r) => ({
      review_id: review.id,
      order_item_id: r.order_item_id,
      rating: r.rating,
    }));
    await supabaseAdmin.from('review_item_ratings').insert(itemRatings);
  }

  // Recalculate restaurant avg rating
  await recalculateAvgRating(payload.restaurant_id);

  // Async sentiment analysis — fire and forget (writes back label+score and busts cache)
  const _text = payload.text_review ?? '';
  setImmediate(async () => {
    try {
      if (!_text) return;
      const { label, score } = await analyzeSentiment(_text);
      await supabaseAdmin.from('reviews').update({ sentiment_label: label, sentiment_score: score }).eq('id', review.id);

      // Best-effort cache invalidation for sentiment caches related to this restaurant
      try {
        const raw = (redis as any).client as import('ioredis').Redis | undefined;
        if (raw && typeof raw.keys === 'function') {
          const pattern = `sentiment:${payload.restaurant_id}:*`;
          const keys: string[] = await raw.keys(pattern);
          if (keys?.length) await redis.del(...keys);
        }
      } catch (e) {
        console.warn('[reviews] cache bust failed', e);
      }
    } catch (err) {
      console.warn('[reviews] sentiment analysis failed', err);
    }
  });

  return review;
}

// ─── Get reviews by restaurant ─────────────────────────────────────────────────
export async function getByRestaurant(
  restaurantId: string,
  page: number,
  limit: number,
  minRating?: number,
  maxRating?: number
) {
  const { from, to } = paginate(page, limit);

  let query = supabaseAdmin
    .from('reviews')
    .select(
      `
      *,
      user:users(id, name, profile_pic_url)
    `,
      { count: 'exact' }
    )
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (minRating !== undefined) query = query.gte('overall_rating', minRating);
  if (maxRating !== undefined) query = query.lte('overall_rating', maxRating);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count };
}

// ─── Get reviews by branch ─────────────────────────────────────────────────────
// FIX: reviews table has no branch_id column — resolve via orders join
export async function getByBranch(branchId: string, page: number, limit: number) {
  const { from, to } = paginate(page, limit);

  // Step 1: collect order IDs that belong to this branch
  const { data: branchOrders, error: ordersErr } = await supabaseAdmin
    .from('orders')
    .select('id')
    .eq('branch_id', branchId);

  if (ordersErr) throw ordersErr;

  const orderIds = (branchOrders ?? []).map((o: any) => o.id);
  if (!orderIds.length) return { data: [], count: 0 };

  // Step 2: get paginated reviews for those orders
  const { data, error, count } = await supabaseAdmin
    .from('reviews')
    .select('*, user:users(id, name, profile_pic_url)', { count: 'exact' })
    .in('order_id', orderIds)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { data, count };
}

// ─── Get review by order ───────────────────────────────────────────────────────
export async function getByOrder(orderId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('reviews')
    .select('*')
    .eq('order_id', orderId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ─── Delete review ─────────────────────────────────────────────────────────────
export async function deleteReview(id: string) {
  const { data: review, error: fetchErr } = await supabaseAdmin
    .from('reviews')
    .select('restaurant_id')
    .eq('id', id)
    .single();

  if (fetchErr) throw fetchErr;

  const { error } = await supabaseAdmin.from('reviews').delete().eq('id', id);
  if (error) throw error;

  await recalculateAvgRating(review.restaurant_id);
}

// ─── Recalculate restaurant avg rating ────────────────────────────────────────
async function recalculateAvgRating(restaurantId: string) {
  const { data, error } = await supabaseAdmin
    .from('reviews')
    .select('overall_rating')
    .eq('restaurant_id', restaurantId);

  if (error || !data?.length) return;

  const avg = data.reduce((sum: number, r: any) => sum + r.overall_rating, 0) / data.length;

  await supabaseAdmin
    .from('restaurants')
    .update({ avg_rating: Math.round(avg * 10) / 10 })
    .eq('id', restaurantId);
}

// ─── Sentiment analysis (public) ───────────────────────────────────────────
export async function analyzeSentiment(text: string): Promise<{ label: 'positive' | 'neutral' | 'negative'; score: number }> {
  const lower = (text ?? '').toLowerCase();

  let positiveCount = 0;
  let negativeCount = 0;
  for (const word of POSITIVE_WORDS) if (lower.includes(word)) positiveCount++;
  for (const word of NEGATIVE_WORDS) if (lower.includes(word)) negativeCount++;

  const keywordScore = positiveCount + negativeCount ? (positiveCount - negativeCount) / (positiveCount + negativeCount) : 0; // -1..1
  let label: 'positive' | 'neutral' | 'negative' = 'neutral';
  if (keywordScore > 0) label = 'positive';
  else if (keywordScore < 0) label = 'negative';

  let finalScore = keywordScore;

  // Option B: call HuggingFace classifier if key present and text long enough
  const hfKey = process.env.HUGGINGFACE_API_KEY;
  if (hfKey && text.length > 20) {
    try {
      const resp = await fetch('https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hfKey}`,
        },
        body: JSON.stringify({ inputs: text }),
      });

      const json = await resp.json();
      // Expecting an array like [{label: 'POSITIVE', score: 0.99}]
      if (Array.isArray(json) && json[0] && typeof json[0].label === 'string' && typeof json[0].score === 'number') {
        const hfLabel = json[0].label.toLowerCase().includes('pos') ? 'positive' : 'negative';
        const hfScore = json[0].score;
        finalScore = hfLabel === 'positive' ? hfScore : -hfScore;
        label = hfLabel as 'positive' | 'negative';
      }
    } catch (e) {
      // silent fallback to keyword scoring
      console.warn('[reviews] HuggingFace sentiment call failed', e);
    }
  }

  return { label, score: Number(finalScore) };
}

// ─── Restaurant sentiment summary (cached) ─────────────────────────────────
export async function getRestaurantSentimentSummary(restaurantId: string, periodDays = 30) {
  const key = `sentiment:${restaurantId}:${periodDays}`;
  try {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    // ignore cache errors
  }

  const now = new Date();
  const currentStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const previousStart = new Date(now.getTime() - periodDays * 2 * 24 * 60 * 60 * 1000);

  const [currentRes, prevRes] = await Promise.all([
    supabaseAdmin
      .from('reviews')
      .select('sentiment_label, text_review')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', currentStart.toISOString())
      .lte('created_at', now.toISOString()),
    supabaseAdmin
      .from('reviews')
      .select('sentiment_label')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', previousStart.toISOString())
      .lt('created_at', currentStart.toISOString()),
  ]);

  if (currentRes.error) throw currentRes.error;
  if (prevRes.error) throw prevRes.error;

  const current = currentRes.data ?? [];
  const previous = prevRes.data ?? [];

  const total = current.length;
  const pos = current.filter((r: any) => r.sentiment_label === 'positive').length;
  const neg = current.filter((r: any) => r.sentiment_label === 'negative').length;
  const neu = total - pos - neg;

  const prevTotal = previous.length;
  const prevPos = previous.filter((r: any) => r.sentiment_label === 'positive').length;

  const toPct = (n: number, t: number) => (t ? Math.round((n / t) * 1000) / 10 : 0);

  // Top keywords by frequency in current period
  const posKeywords: Record<string, number> = {};
  const negKeywords: Record<string, number> = {};
  for (const r of current) {
    const text = (r.text_review ?? '').toLowerCase();
    for (const word of POSITIVE_WORDS) if (text.includes(word)) posKeywords[word] = (posKeywords[word] ?? 0) + 1;
    for (const word of NEGATIVE_WORDS) if (text.includes(word)) negKeywords[word] = (negKeywords[word] ?? 0) + 1;
  }

  const topN = (map: Record<string, number>, n = 5) =>
    Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ keyword: k, count: v }));

  const result = {
    restaurant_id: restaurantId,
    period_days: periodDays,
    total_reviews: total,
    positive_pct: toPct(pos, total),
    neutral_pct: toPct(neu, total),
    negative_pct: toPct(neg, total),
    top_positive_keywords: topN(posKeywords),
    top_negative_keywords: topN(negKeywords),
    trend_positive_pct: toPct(pos, total) - toPct(prevPos, prevTotal),
  };

  try {
    await redis.setex(key, 3600, JSON.stringify(result));
  } catch (e) {
    // ignore cache write errors
  }

  return result;
}