import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

class AdminService {
  private getAuthHeaders() {
    const token = localStorage.getItem('auth_token');
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async getStatistics() {
    const response = await axios.get(`${API_BASE_URL}/admin/statistics`, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async getRecentActivity(limit: number = 50) {
    const response = await axios.get(`${API_BASE_URL}/admin/activity`, {
      headers: this.getAuthHeaders(),
      params: { limit },
    });
    return response.data;
  }

  async getDisputes(status?: string) {
    const response = await axios.get(`${API_BASE_URL}/admin/disputes`, {
      headers: this.getAuthHeaders(),
      params: status ? { status } : {},
    });
    return response.data;
  }

  async createDispute(disputeData: {
    swapId: string;
    reporterId: string;
    reportedUserId: string;
    type: 'fraud' | 'booking_invalid' | 'payment_issue' | 'other';
    description: string;
    evidence?: string[];
    priority?: 'low' | 'medium' | 'high' | 'critical';
  }) {
    const response = await axios.post(
      `${API_BASE_URL}/admin/disputes`,
      disputeData,
      {
        headers: this.getAuthHeaders(),
      }
    );
    return response.data;
  }

  async resolveDispute(
    disputeId: string,
    resolution: {
      action: string;
      notes: string;
    }
  ) {
    const response = await axios.put(
      `${API_BASE_URL}/admin/disputes/${disputeId}/resolve`,
      resolution,
      {
        headers: this.getAuthHeaders(),
      }
    );
    return response.data;
  }

  async flagUser(
    userId: string,
    flag: {
      reason: string;
      severity: 'warning' | 'suspension' | 'ban';
      expiresAt?: string;
    }
  ) {
    const response = await axios.post(
      `${API_BASE_URL}/admin/users/${userId}/flag`,
      flag,
      {
        headers: this.getAuthHeaders(),
      }
    );
    return response.data;
  }

  async unflagUser(userId: string) {
    const response = await axios.delete(
      `${API_BASE_URL}/admin/users/${userId}/flag`,
      {
        headers: this.getAuthHeaders(),
      }
    );
    return response.data;
  }

  async investigateTransaction(transactionId: string) {
    const response = await axios.get(
      `${API_BASE_URL}/admin/transactions/${transactionId}/investigate`,
      {
        headers: this.getAuthHeaders(),
      }
    );
    return response.data;
  }

  async enableMaintenanceMode(message: string) {
    const response = await axios.post(
      `${API_BASE_URL}/admin/maintenance/enable`,
      { message },
      {
        headers: this.getAuthHeaders(),
      }
    );
    return response.data;
  }

  async disableMaintenanceMode() {
    const response = await axios.post(
      `${API_BASE_URL}/admin/maintenance/disable`,
      {},
      {
        headers: this.getAuthHeaders(),
      }
    );
    return response.data;
  }
}

export const adminService = new AdminService();
