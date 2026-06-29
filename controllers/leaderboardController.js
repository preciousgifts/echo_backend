const supabase = require('../config/database');
const logger = require('../config/logger');

class LeaderboardController {
  // Compute rankings live from the users table — no separate leaderboard table required
  static async getLeaderboard(req, res) {
    try {
      const { page = 1, limit = 50 } = req.query;
      const currentUserId = req.user.user_id;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Fetch paginated users ordered by points
      const { data: users, error, count } = await supabase
        .from('users')
        .select('user_id, first_name, last_name, country, region, primary_language_name, profile_pic, points', { count: 'exact' })
        .eq('is_active', true)
        .order('points', { ascending: false })
        .range(offset, offset + parseInt(limit) - 1);

      if (error) {
        logger.error('Failed to fetch leaderboard', { error: error.message });
        return res.status(400).json({ success: false, message: 'Failed to retrieve leaderboard' });
      }

      const leaderboard = (users || []).map((u, idx) => ({
        user_id: u.user_id,
        rank: offset + idx + 1,
        total_points: u.points || 0,
        name: u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : 'Unknown',
        first_name: u.first_name || '',
        last_name: u.last_name || '',
        country: u.country || '',
        region: u.region || '',
        primary_language_name: u.primary_language_name || '',
        profile_pic: u.profile_pic || null,
        is_current_user: u.user_id === currentUserId,
      }));

      // Find current user's global rank
      let currentUserRank = null;
      const currentUserEntry = leaderboard.find((u) => u.is_current_user);
      if (currentUserEntry) {
        currentUserRank = currentUserEntry;
      } else {
        // User not on this page — find their position separately
        const { count: aboveCount } = await supabase
          .from('users')
          .select('user_id', { count: 'exact', head: true })
          .eq('is_active', true)
          .gt('points', supabase.rpc ? 0 : 0); // fallback: fetch user's own points

        const { data: me } = await supabase
          .from('users')
          .select('user_id, first_name, last_name, country, primary_language_name, points')
          .eq('user_id', currentUserId)
          .single();

        if (me) {
          // Count how many users have strictly more points
          const { count: ahead } = await supabase
            .from('users')
            .select('user_id', { count: 'exact', head: true })
            .eq('is_active', true)
            .gt('points', me.points || 0);

          currentUserRank = {
            user_id: me.user_id,
            rank: (ahead || 0) + 1,
            total_points: me.points || 0,
            name: me.first_name ? `${me.first_name} ${me.last_name || ''}`.trim() : 'Me',
            is_current_user: true,
          };
        }
      }

      res.json({
        success: true,
        data: {
          leaderboard,
          current_user_rank: currentUserRank,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count || 0,
            totalPages: Math.ceil((count || 0) / parseInt(limit)),
          },
        },
      });
    } catch (error) {
      logger.error('Get leaderboard error', { error: error.message });
      res.status(500).json({ success: false, message: 'Failed to retrieve leaderboard' });
    }
  }
}

module.exports = LeaderboardController;
