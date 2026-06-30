import supabase from '../config/database.js';
import logger from '../config/logger.js';

class AnalyticsController {
  static async getDashboardStats(req, res) {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [
        { count: totalUsers },
        { count: activeUsers },
        { count: activeContributors },
        { count: activeValidators },
        { count: totalRecordings },
        { count: validatedRecordings },
        { count: rejectedRecordings },
        { count: pendingRecordings },
        { count: languagesCovered },
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }).gte('last_login_at', sevenDaysAgo.toISOString()),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'contributor').eq('is_active', true),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'validator').eq('is_active', true),
        supabase.from('recordings').select('*', { count: 'exact', head: true }),
        supabase.from('recordings').select('*', { count: 'exact', head: true }).eq('status', 'validated'),
        supabase.from('recordings').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
        supabase.from('recordings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('languages').select('*', { count: 'exact', head: true }),
      ]);

      // Compute hours collected from sum of durations (duration stored in seconds)
      const { data: durationData } = await supabase
        .from('recordings')
        .select('duration')
        .eq('status', 'validated');

      const hoursCollected = durationData
        ? parseFloat((durationData.reduce((sum, r) => sum + (r.duration || 0), 0) / 3600).toFixed(2))
        : 0;

      const avgDuration = durationData?.length
        ? parseFloat((durationData.reduce((sum, r) => sum + (r.duration || 0), 0) / durationData.length).toFixed(2))
        : 0;

      // New users this week
      const { count: newUsersWeekly } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo.toISOString());

      res.json({
        success: true,
        data: {
          stats: {
            total_users: totalUsers || 0,
            active_users: activeUsers || 0,
            active_contributors: activeContributors || 0,
            active_validators: activeValidators || 0,
            total_recordings: totalRecordings || 0,
            validated_recordings: validatedRecordings || 0,
            rejected_recordings: rejectedRecordings || 0,
            pending_recordings: pendingRecordings || 0,
            languages_covered: languagesCovered || 0,
            hours_collected: hoursCollected,
            avg_recording_duration: avgDuration,
            new_users_weekly: newUsersWeekly || 0,
          },
        },
      });
    } catch (error) {
      logger.error('Get dashboard stats error', { error: error.message });
      res.status(500).json({ success: false, message: 'Failed to retrieve dashboard statistics' });
    }
  }

  static async createAnalyticsSnapshot(req, res) {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [
        { count: totalUsers },
        { count: activeUsers },
        { count: activeContributors },
        { count: activeValidators },
        { count: totalRecordings },
        { count: validatedRecordings },
        { count: rejectedRecordings },
        { count: languagesCovered },
        { count: newUsersWeekly },
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }).gte('last_login_at', sevenDaysAgo.toISOString()),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'contributor').eq('is_active', true),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'validator').eq('is_active', true),
        supabase.from('recordings').select('*', { count: 'exact', head: true }),
        supabase.from('recordings').select('*', { count: 'exact', head: true }).eq('status', 'validated'),
        supabase.from('recordings').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
        supabase.from('languages').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo.toISOString()),
      ]);

      const { data: durationData } = await supabase.from('recordings').select('duration').eq('status', 'validated');
      const totalSeconds = durationData?.reduce((s, r) => s + (r.duration || 0), 0) || 0;
      const hoursCollected = parseFloat((totalSeconds / 3600).toFixed(2));
      const avgDuration = durationData?.length ? parseFloat((totalSeconds / durationData.length).toFixed(2)) : 0;

      // Only insert columns that exist in analytic_snapshots
      const snapshotData = {
        total_users: totalUsers || 0,
        active_users: activeUsers || 0,
        active_contributors: activeContributors || 0,
        active_validators: activeValidators || 0,
        total_recordings: totalRecordings || 0,
        validated_recordings: validatedRecordings || 0,
        rejected_recordings: rejectedRecordings || 0,
        hours_collected: hoursCollected,
        avg_recording_duration: avgDuration,
        languages_covered: languagesCovered || 0,
        new_users_weekly: newUsersWeekly || 0,
      };

      const { data: snapshot, error } = await supabase
        .from('analytic_snapshots')
        .insert([snapshotData])
        .select()
        .single();

      if (error) {
        logger.error('Analytics snapshot creation failed', { error: error.message });
        return res.status(400).json({ success: false, message: 'Failed to create analytics snapshot' });
      }

      logger.info('Analytics snapshot created');

      res.status(201).json({ success: true, message: 'Analytics snapshot created successfully', data: { snapshot } });
    } catch (error) {
      logger.error('Create analytics snapshot error', { error: error.message });
      res.status(500).json({ success: false, message: 'Failed to create analytics snapshot' });
    }
  }

  static async getAnalyticsSnapshots(req, res) {
    try {
      const { start_date, end_date, page = 1, limit = 10 } = req.query;

      let query = supabase.from('analytic_snapshots').select('*', { count: 'exact' });

      if (start_date) query = query.gte('created_at', start_date);
      if (end_date) query = query.lte('created_at', end_date);

      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

      const { data: snapshots, error, count } = await query;

      if (error) {
        logger.error('Failed to fetch analytics snapshots', { error: error.message });
        return res.status(400).json({ success: false, message: 'Failed to retrieve analytics snapshots' });
      }

      res.json({
        success: true,
        data: { snapshots, pagination: { page: parseInt(page), limit: parseInt(limit), total: count } },
      });
    } catch (error) {
      logger.error('Get analytics snapshots error', { error: error.message });
      res.status(500).json({ success: false, message: 'Failed to retrieve analytics snapshots' });
    }
  }
}

export default AnalyticsController;
