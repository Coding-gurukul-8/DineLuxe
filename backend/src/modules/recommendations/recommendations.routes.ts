import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { getPersonalized, getPopular } from './recommendations.controller';

const router: import('express').Router = Router();

// GET /recommendations/personalized?lat=&lon=&radius=
// Requires authentication — score is personalised to req.user.id
router.get('/personalized', authenticate, getPersonalized);

// GET /recommendations/popular?lat=&lon=&radius=&cuisine=
// Public — no auth required, works for guest / logged-out users
router.get('/popular', getPopular);

export default router;