"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.list = list;
exports.create = create;
exports.getById = getById;
exports.update = update;
exports.remove = remove;
async function list() {
    return [];
}
async function create(payload) {
    return { id: 'temp', ...payload };
}
async function getById(id) {
    return { id };
}
async function update(id, payload) {
    return { id, ...payload };
}
async function remove(id) {
    return { id, deleted: true };
}
//# sourceMappingURL=waste-log.service.js.map