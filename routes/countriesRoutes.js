const express = require('express');
const router = express.Router();
const CountriesController = require('../controllers/countriesController');

router.get('/', CountriesController.getAllCountries);

module.exports = router;
