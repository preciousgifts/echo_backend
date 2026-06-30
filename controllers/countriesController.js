import supabase from '../config/database.js';
import logger from '../config/logger.js';

class CountriesController {
  static async getAllCountries(req, res) {
    try {
      const { data, error } = await supabase
        .from('african_countries')
        .select('id, label, iso, dial_code')
        .order('label', { ascending: true });

      if (error) {
        logger.error('Failed to fetch countries', { error: error.message });
        return res.status(400).json({ success: false, message: 'Failed to fetch countries' });
      }

      res.json({ success: true, data });
    } catch (error) {
      logger.error('Countries fetch error', { error: error.message });
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}

export default CountriesController;
