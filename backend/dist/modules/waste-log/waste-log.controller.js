"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.list = list;
exports.create = create;
exports.getById = getById;
exports.update = update;
exports.remove = remove;
const response_1 = require("../../utils/response");
const wasteLogService = __importStar(require("./waste-log.service"));
async function list(req, res, next) {
    try {
        const data = await wasteLogService.list();
        res.json((0, response_1.success)(data));
    }
    catch (err) {
        next(err);
    }
}
async function create(req, res, next) {
    try {
        const data = await wasteLogService.create(req.body);
        res.status(201).json((0, response_1.success)(data));
    }
    catch (err) {
        next(err);
    }
}
async function getById(req, res, next) {
    try {
        const data = await wasteLogService.getById(req.params.id);
        res.json((0, response_1.success)(data));
    }
    catch (err) {
        next(err);
    }
}
async function update(req, res, next) {
    try {
        const data = await wasteLogService.update(req.params.id, req.body);
        res.json((0, response_1.success)(data));
    }
    catch (err) {
        next(err);
    }
}
async function remove(req, res, next) {
    try {
        const data = await wasteLogService.remove(req.params.id);
        res.json((0, response_1.success)(data));
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=waste-log.controller.js.map