"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCreateOrder = handleCreateOrder;
exports.handleGetOrder = handleGetOrder;
exports.handleGetOrdersByTable = handleGetOrdersByTable;
exports.handleGetActiveBranchOrders = handleGetActiveBranchOrders;
exports.handleCancelOrder = handleCancelOrder;
const response_1 = require("../../utils/response");
const orders_service_1 = require("./orders.service");
const STAFF_ORDER_ROLES = ['waiter', 'manager', 'owner', 'cashier', 'host'];
async function handleCreateOrder(req, res, next) {
    try {
        const body = req.body;
        const rawCustomerId = body.customer_id;
        const { customer_id: _c, ...orderPayload } = body;
        void _c;
        const customerIdOverride = STAFF_ORDER_ROLES.includes(req.user.role) && typeof rawCustomerId === 'string'
            ? rawCustomerId
            : undefined;
        const order = await (0, orders_service_1.createOrder)(orderPayload, req.restaurantId, req.branchId, req.user.id, customerIdOverride);
        res.status(201).json((0, response_1.success)(order, 'Order created successfully'));
    }
    catch (err) {
        next(err);
    }
}
async function handleGetOrder(req, res, next) {
    try {
        const order = await (0, orders_service_1.getOrderById)(req.params.id, req.branchId);
        res.json((0, response_1.success)(order));
    }
    catch (err) {
        next(err);
    }
}
async function handleGetOrdersByTable(req, res, next) {
    try {
        const orders = await (0, orders_service_1.getOrdersByTable)(req.params.tableId, req.branchId);
        res.json((0, response_1.success)(orders));
    }
    catch (err) {
        next(err);
    }
}
async function handleGetActiveBranchOrders(req, res, next) {
    try {
        const orders = await (0, orders_service_1.getActiveBranchOrders)(req.params.branchId);
        res.json((0, response_1.success)(orders));
    }
    catch (err) {
        next(err);
    }
}
async function handleCancelOrder(req, res, next) {
    try {
        const order = await (0, orders_service_1.cancelOrder)(req.params.id, req.branchId, req.body.reason);
        res.json((0, response_1.success)(order, 'Order cancelled'));
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=orders.controller.js.map