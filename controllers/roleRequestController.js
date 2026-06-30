import supabase from '../config/database.js';
import logger from '../config/logger.js';
import { v4 as uuidv4 } from 'uuid';

const VALID_UPGRADES = {
  contributor: ['validator', 'admin'],
  validator: ['admin'],
  admin: [],
};

class RoleRequestController {
  // Submit a role upgrade request
  static async createRequest(req, res) {
    try {
      const userId = req.user.user_id;
      const currentRole = req.user.role;
      const { requested_role, reason } = req.body || {};

      if (!requested_role) {
        return res.status(400).json({ success: false, message: 'requested_role is required' });
      }

      if (!(VALID_UPGRADES[currentRole] || []).includes(requested_role)) {
        return res.status(400).json({
          success: false,
          message: `Role "${requested_role}" is not a valid upgrade from "${currentRole}"`,
        });
      }

      // Block if a pending request already exists
      const { data: existing } = await supabase
        .from('role_requests')
        .select('request_id')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .maybeSingle();

      if (existing) {
        return res.status(409).json({ success: false, message: 'You already have a pending role request' });
      }

      const { data, error } = await supabase
        .from('role_requests')
        .insert([{
          request_id: uuidv4(),
          user_id: userId,
          requested_role,
          from_role: currentRole,
          reason: reason || null,
          status: 'pending',
          created_at: new Date(),
          updated_at: new Date(),
        }])
        .select('*')
        .single();

      if (error) {
        logger.error('Failed to create role request', { error: error.message });
        return res.status(400).json({ success: false, message: 'Failed to submit request' });
      }

      logger.info('Role request created', { userId, requested_role });
      res.status(201).json({ success: true, message: 'Role request submitted successfully', data });
    } catch (error) {
      logger.error('Create role request error', { error: error.message });
      res.status(500).json({ success: false, message: 'Failed to submit role request' });
    }
  }

  // Get all requests — admin only
  static async getAllRequests(req, res) {
    try {
      const { status = 'pending', page = 1, limit = 20 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let query = supabase
        .from('role_requests')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + parseInt(limit) - 1);

      if (status !== 'all') query = query.eq('status', status);

      const { data: requests, error, count } = await query;

      if (error) {
        logger.error('Failed to fetch role requests', { error: error.message });
        return res.status(400).json({ success: false, message: 'Failed to fetch requests' });
      }

      // Enrich with user and reviewer info (two separate queries)
      const userIds = [...new Set([
        ...(requests || []).map(r => r.user_id),
        ...(requests || []).map(r => r.reviewed_by).filter(Boolean),
      ])];

      let usersMap = {};
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('user_id, first_name, last_name, email, role')
          .in('user_id', userIds);
        usersMap = Object.fromEntries((users || []).map(u => [u.user_id, u]));
      }

      const enriched = (requests || []).map(r => ({
        ...r,
        user: usersMap[r.user_id] || null,
        reviewer: r.reviewed_by ? (usersMap[r.reviewed_by] || null) : null,
      }));

      res.json({
        success: true,
        data: {
          requests: enriched,
          pagination: { page: parseInt(page), limit: parseInt(limit), total: count || 0 },
        },
      });
    } catch (error) {
      logger.error('Get role requests error', { error: error.message });
      res.status(500).json({ success: false, message: 'Failed to fetch role requests' });
    }
  }

  // Get current user's own requests
  static async getMyRequests(req, res) {
    try {
      const userId = req.user.user_id;

      const { data, error } = await supabase
        .from('role_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(400).json({ success: false, message: 'Failed to fetch your requests' });
      }

      const reviewerIds = (data || []).map(r => r.reviewed_by).filter(Boolean);
      let reviewersMap = {};
      if (reviewerIds.length > 0) {
        const { data: reviewers } = await supabase
          .from('users')
          .select('user_id, first_name, last_name')
          .in('user_id', reviewerIds);
        reviewersMap = Object.fromEntries((reviewers || []).map(u => [u.user_id, u]));
      }

      const enriched = (data || []).map(r => ({
        ...r,
        reviewer: r.reviewed_by ? (reviewersMap[r.reviewed_by] || null) : null,
      }));

      res.json({ success: true, data: enriched });
    } catch (error) {
      logger.error('Get my role requests error', { error: error.message });
      res.status(500).json({ success: false, message: 'Failed to fetch requests' });
    }
  }

  // Approve or reject a request — admin only (audit trail: reviewed_by, reviewed_at)
  static async reviewRequest(req, res) {
    try {
      const adminId = req.user.user_id;
      const { requestId } = req.params;
      const { action } = req.body || {};

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ success: false, message: 'action must be "approve" or "reject"' });
      }

      const { data: request, error: fetchError } = await supabase
        .from('role_requests')
        .select('*')
        .eq('request_id', requestId)
        .single();

      if (fetchError || !request) {
        return res.status(404).json({ success: false, message: 'Request not found' });
      }

      if (request.status !== 'pending') {
        return res.status(400).json({ success: false, message: 'This request has already been reviewed' });
      }

      const newStatus = action === 'approve' ? 'approved' : 'rejected';

      await supabase
        .from('role_requests')
        .update({ status: newStatus, reviewed_by: adminId, reviewed_at: new Date(), updated_at: new Date() })
        .eq('request_id', requestId);

      if (action === 'approve') {
        await supabase
          .from('users')
          .update({ role: request.requested_role, updated_at: new Date() })
          .eq('user_id', request.user_id);
      }

      logger.info('Role request reviewed', { requestId, action, adminId, userId: request.user_id });

      res.json({ success: true, message: `Request ${newStatus} successfully` });
    } catch (error) {
      logger.error('Review role request error', { error: error.message });
      res.status(500).json({ success: false, message: 'Failed to review request' });
    }
  }
}

export default RoleRequestController;
