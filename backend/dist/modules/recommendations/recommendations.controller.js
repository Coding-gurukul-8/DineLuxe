"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPersonalized = getPersonalized;
exports.getPopular = getPopular;
const response_1 = require("../../utils/response");
const recommendations_service_1 = require("./recommendations.service");
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseCoord(val, name) {
    const n = Number(val);
    if (!Number.isFinite(n)) {
        throw Object.assign(new Error(`Query param '${name}' must be a valid number`), {
            status: 400,
            code: 'INVALID_QUERY_PARAM',
        });
    }
    return n;
}
// ---------------------------------------------------------------------------
// GET /recommendations/personalized?lat=&lon=&radius=
// Requires: authenticate (userId from req.user.id)
// ---------------------------------------------------------------------------
async function getPersonalized(req, res, next) {
    try {
        const userId = req.user?.id;
        const lat = parseCoord(req.query.lat, 'lat');
        const lon = parseCoord(req.query.lon, 'lon');
        const radiusKm = req.query.radius !== undefined ? parseCoord(req.query.radius, 'radius') : 5;
        const data = await (0, recommendations_service_1.getPersonalizedRecommendations)(userId, lat, lon, radiusKm);
        res.json((0, response_1.success)(data));
    }
    catch (err) {
        next(err);
    }
}
// ---------------------------------------------------------------------------
// GET /recommendations/popular?lat=&lon=&radius=&cuisine=
// No auth required
// ---------------------------------------------------------------------------
async function getPopular(req, res, next) {
    try {
        const lat = parseCoord(req.query.lat, 'lat');
        const lon = parseCoord(req.query.lon, 'lon');
        const radiusKm = req.query.radius !== undefined ? parseCoord(req.query.radius, 'radius') : 5;
        const cuisine = typeof req.query.cuisine === 'string' && req.query.cuisine.trim()
            ? req.query.cuisine.trim()
            : undefined;
        const data = await (0, recommendations_service_1.getPopularNearby)(lat, lon, radiusKm, cuisine);
        res.json((0, response_1.success)(data));
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=recommendations.controller.js.map