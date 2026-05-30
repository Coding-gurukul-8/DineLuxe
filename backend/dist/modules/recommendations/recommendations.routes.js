"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const recommendations_controller_1 = require("./recommendations.controller");
const router = (0, express_1.Router)();
// GET /recommendations/personalized?lat=&lon=&radius=
// Requires authentication — score is personalised to req.user.id
router.get('/personalized', auth_middleware_1.authenticate, recommendations_controller_1.getPersonalized);
// GET /recommendations/popular?lat=&lon=&radius=&cuisine=
// Public — no auth required, works for guest / logged-out users
router.get('/popular', recommendations_controller_1.getPopular);
exports.default = router;
//# sourceMappingURL=recommendations.routes.js.map