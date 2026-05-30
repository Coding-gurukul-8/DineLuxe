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
export declare function submitFeedback(userId: string, restaurantId: string, branchId: string | undefined, role: string, feedbackText: string): Promise<{
    message: string;
}>;
export declare function getFeedbackForRestaurant(restaurantId: string, options: {
    branch_id?: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
    page: number;
    limit: number;
}): Promise<FeedbackListResult>;
export declare function getFeedbackForAdmin(options: {
    restaurant_id?: string;
    branch_id?: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
    page: number;
    limit: number;
}): Promise<FeedbackListResult>;
export declare function flagFeedback(feedbackId: string, restaurantId: string, isFlagged: boolean): Promise<FeedbackItem>;
//# sourceMappingURL=staff-feedback.service.d.ts.map