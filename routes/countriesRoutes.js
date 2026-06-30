import express from 'express';
const router = express.Router();
import CountriesController from '../controllers/countriesController.js';

router.get('/', CountriesController.getAllCountries);

export default router;
