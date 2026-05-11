export interface ApiResponse<T> {
    success: boolean;
    data: T;
    meta?: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
    message?: string;
}
export interface ApiErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        field?: string;
    };
}
export declare class ApiError extends Error {
    statusCode: number;
    code: string;
    field?: string | undefined;
    constructor(statusCode: number, code: string, message: string, field?: string | undefined);
}
//# sourceMappingURL=api.d.ts.map