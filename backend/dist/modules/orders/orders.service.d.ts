import type { CreateOrderInput } from './orders.schema';
export declare function createOrder(input: CreateOrderInput, restaurantId: string, branchId: string, createdBy: string, customerIdOverride?: string | null): Promise<any>;
export declare function getOrderById(orderId: string, branchId?: string, userId?: string): Promise<any>;
export declare function getOrdersByTable(tableId: string, branchId: string): Promise<any[]>;
export declare function getMyOrders(userId: string, branchId: string | undefined, query: Record<string, string | undefined>): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
}>;
export declare function getStaffOrders(branchId: string, query: Record<string, string | undefined>): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
}>;
export declare function getActiveBranchOrders(branchId: string): Promise<any[]>;
export declare function cancelOrder(orderId: string, branchId: string, reason?: string): Promise<any>;
//# sourceMappingURL=orders.service.d.ts.map