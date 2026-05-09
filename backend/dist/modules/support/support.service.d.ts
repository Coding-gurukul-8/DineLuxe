type ConversationEntry = {
    sender_id: string;
    sender_role: string;
    message: string;
    created_at: string;
    attachments?: unknown[];
};
export declare function createTicket(userId: string, payload: {
    subject: string;
    description: string;
    category: string;
    order_id?: string;
    priority: string;
}): Promise<any>;
export declare function getTickets(userId: string, role: string, page: number, limit: number): Promise<{
    data: any[];
    count: number | null;
}>;
export declare function getTicketById(ticketId: string, userId: string, role: string): Promise<any>;
export declare function updateTicketStatus(ticketId: string, agentId: string, status: string, _resolutionNote?: string): Promise<any>;
export declare function postMessage(ticketId: string, senderId: string, senderRole: string, message: string, attachments?: string[]): Promise<any>;
export declare function getMessages(ticketId: string, userId: string, role: string): Promise<ConversationEntry[]>;
export declare function autoEscalateStaleTickets(): Promise<number | undefined>;
export {};
//# sourceMappingURL=support.service.d.ts.map