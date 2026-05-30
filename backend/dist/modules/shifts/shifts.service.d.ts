export interface ShiftRow {
    id: string;
    branch_id: string;
    staff_id: string;
    staff_name: string;
    staff_role: string;
    employee_id: string | null;
    date: string;
    start_time: string;
    end_time: string;
    notes: string | null;
    created_by: string;
    created_at: string;
}
export interface GroupedShift {
    staff_id: string;
    staff_name: string;
    staff_role: string;
    employee_id: string | null;
    shifts: Omit<ShiftRow, 'staff_id' | 'staff_name' | 'staff_role' | 'employee_id'>[];
}
export declare function getShiftsForWeek(branchId: string, weekStart: string, restaurantId: string, staffId?: string): Promise<GroupedShift[]>;
export declare function createShift(data: {
    branch_id: string;
    staff_id: string;
    date: string;
    start_time: string;
    end_time: string;
    notes?: string;
}, createdBy: string, restaurantId: string): Promise<ShiftRow>;
export declare function createShiftForStaff(staffId: string, data: {
    date: string;
    start_time: string;
    end_time: string;
    notes?: string;
}, createdBy: string, branchId: string, restaurantId: string): Promise<ShiftRow>;
export declare function updateShift(shiftId: string, updates: {
    start_time?: string;
    end_time?: string;
    notes?: string;
}, restaurantId: string): Promise<ShiftRow>;
export declare function deleteShift(shiftId: string, restaurantId: string): Promise<{
    deleted: true;
    id: string;
}>;
//# sourceMappingURL=shifts.service.d.ts.map