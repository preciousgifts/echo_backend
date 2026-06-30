import supabase from '../config/database.js';
import logger from '../config/logger.js';
import { v4 as uuidv4 } from 'uuid';

class MicropaymentController {
  // Admin initiates a payment to a contributor
  static async createPayment(req, res) {
    try {
      const initiatedBy = req.user.user_id;
      const { user_id, amount, currency, payment_method, reason, metadata } = req.body;

      if (!user_id || !amount || !payment_method || !reason) {
        return res.status(400).json({
          success: false,
          message: 'user_id, amount, payment_method, and reason are required',
        });
      }

      // Confirm target user exists
      const { data: targetUser, error: userError } = await supabase
        .from('users')
        .select('user_id, first_name, last_name, email')
        .eq('user_id', user_id)
        .eq('is_active', true)
        .single();

      if (userError || !targetUser) {
        return res.status(404).json({ success: false, message: 'Target user not found' });
      }

      const paymentData = {
        payment_id: uuidv4(),
        user_id,
        amount,
        currency: currency || 'NGN',
        payment_method,
        status: 'pending',
        reason,
        initiated_by: initiatedBy,
        metadata: metadata || null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const { data: payment, error } = await supabase
        .from('payments')
        .insert([paymentData])
        .select()
        .single();

      if (error) {
        logger.error('Payment creation failed', { error: error.message, initiatedBy, user_id });
        return res.status(400).json({ success: false, message: 'Failed to create payment' });
      }

      // Log admin action
      await supabase.from('admin_actions').insert([{
        action_id: uuidv4(),
        admin_id: initiatedBy,
        action_type: 'payment_initiated',
        description: `Payment of ${amount} ${currency || 'NGN'} initiated to user ${user_id}`,
        details: { payment_id: payment.payment_id, user_id, amount, reason },
        created_at: new Date(),
      }]);

      logger.info('Payment created', { paymentId: payment.payment_id, initiatedBy, user_id });

      res.status(201).json({ success: true, message: 'Payment created successfully', data: { payment } });
    } catch (error) {
      logger.error('Create payment error', { error: error.message });
      res.status(500).json({ success: false, message: 'Failed to create payment' });
    }
  }

  // Update a payment status (mark completed / failed)
  static async updatePaymentStatus(req, res) {
    try {
      const { paymentId } = req.params;
      const { status, reference_id } = req.body;

      const validStatuses = ['pending', 'completed', 'failed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `status must be one of: ${validStatuses.join(', ')}`,
        });
      }

      const updates = {
        status,
        updated_at: new Date(),
      };

      if (reference_id) updates.reference_id = reference_id;
      if (status === 'completed') updates.paid_at = new Date();

      const { data: payment, error } = await supabase
        .from('payments')
        .update(updates)
        .eq('payment_id', paymentId)
        .select()
        .single();

      if (error) {
        logger.error('Payment status update failed', { paymentId, error: error.message });
        return res.status(400).json({ success: false, message: 'Failed to update payment status' });
      }

      if (!payment) {
        return res.status(404).json({ success: false, message: 'Payment not found' });
      }

      logger.info('Payment status updated', { paymentId, status });

      res.json({ success: true, message: 'Payment status updated', data: { payment } });
    } catch (error) {
      logger.error('Update payment status error', { error: error.message });
      res.status(500).json({ success: false, message: 'Failed to update payment status' });
    }
  }

  // Get all payments (admin)
  static async getAllPayments(req, res) {
    try {
      const { page = 1, limit = 20, status, user_id } = req.query;

      let query = supabase
        .from('payments')
        .select('*', { count: 'exact' });

      if (status) query = query.eq('status', status);
      if (user_id) query = query.eq('user_id', user_id);

      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

      const { data: payments, error, count } = await query;

      if (error) {
        logger.error('Failed to fetch payments', { error: error.message });
        return res.status(400).json({ success: false, message: 'Failed to retrieve payments' });
      }

      res.json({
        success: true,
        data: {
          payments,
          pagination: { page: parseInt(page), limit: parseInt(limit), total: count, totalPages: Math.ceil(count / limit) },
        },
      });
    } catch (error) {
      logger.error('Get all payments error', { error: error.message });
      res.status(500).json({ success: false, message: 'Failed to retrieve payments' });
    }
  }

  // Get payments for the authenticated user
  static async getMyPayments(req, res) {
    try {
      const userId = req.user.user_id;
      const { page = 1, limit = 20, status } = req.query;

      let query = supabase
        .from('payments')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      if (status) query = query.eq('status', status);

      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

      const { data: payments, error, count } = await query;

      if (error) {
        logger.error('Failed to fetch user payments', { userId, error: error.message });
        return res.status(400).json({ success: false, message: 'Failed to retrieve payments' });
      }

      res.json({
        success: true,
        data: {
          payments,
          pagination: { page: parseInt(page), limit: parseInt(limit), total: count, totalPages: Math.ceil(count / limit) },
        },
      });
    } catch (error) {
      logger.error('Get my payments error', { error: error.message });
      res.status(500).json({ success: false, message: 'Failed to retrieve payments' });
    }
  }

  // Get a single payment by ID
  static async getPaymentById(req, res) {
    try {
      const { paymentId } = req.params;
      const userId = req.user.user_id;
      const isAdmin = req.user.role === 'admin';

      let query = supabase.from('payments').select('*').eq('payment_id', paymentId);

      // Non-admins can only see their own payments
      if (!isAdmin) query = query.eq('user_id', userId);

      const { data: payment, error } = await query.single();

      if (error || !payment) {
        return res.status(404).json({ success: false, message: 'Payment not found' });
      }

      res.json({ success: true, data: { payment } });
    } catch (error) {
      logger.error('Get payment by ID error', { error: error.message });
      res.status(500).json({ success: false, message: 'Failed to retrieve payment' });
    }
  }
}

export default MicropaymentController;
