export type WasteLogRecord = Record<string, unknown> & {
    id: string;
};
export declare function list(): Promise<WasteLogRecord[]>;
export declare function create(payload: Record<string, unknown>): Promise<WasteLogRecord>;
export declare function getById(id: string): Promise<WasteLogRecord>;
export declare function update(id: string, payload: Record<string, unknown>): Promise<WasteLogRecord>;
export declare function remove(id: string): Promise<{
    id: string;
    deleted: true;
}>;
//# sourceMappingURL=waste-log.service.d.ts.map