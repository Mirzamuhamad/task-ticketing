import type { AuditLog, Category, NotificationItem, Ticket, TicketMessage, TicketPriority, TicketStats, User } from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export function uploadUrl(path: string) {
  const base = API_URL.replace(/\/api$/, '');
  return `${base}${path}`;
}

export class ApiClient {
  private token: string | null = localStorage.getItem('ticketing_token');

  setToken(token: string | null) {
    this.token = token;
    if (token) localStorage.setItem('ticketing_token', token);
    else localStorage.removeItem('ticketing_token');
  }

  getToken() {
    return this.token;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (!(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    const response = await fetch(`${API_URL}${path}`, { ...init, headers });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request gagal' }));
      throw new Error(Array.isArray(error.message) ? error.message.join(', ') : error.message);
    }
    return response.json();
  }

  login(email: string, password: string) {
    return this.request<{ user: User; accessToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  me() {
    return this.request<User>('/auth/me');
  }

  categories() {
    return this.request<Category[]>('/categories');
  }

  users() {
    return this.request<User[]>('/users');
  }

  tickets() {
    return this.request<Ticket[]>('/tickets');
  }

  stats() {
    return this.request<TicketStats>('/tickets/stats');
  }

  ticket(id: number) {
    return this.request<Ticket>(`/tickets/${id}`);
  }

  createTicket(payload: { title: string; categoryId: number; customerId?: number; priority: TicketPriority; description: string }) {
    return this.request<Ticket>('/tickets', { method: 'POST', body: JSON.stringify(payload) });
  }

  updateTicket(id: number, payload: { status?: string; assignedTo?: number }) {
    return this.request<Ticket>(`/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  }

  closeTicket(id: number) {
    return this.request<Ticket>(`/tickets/${id}/close`, { method: 'PATCH' });
  }

  sendMessage(ticketId: number, message: string) {
    return this.request<TicketMessage>('/messages', { method: 'POST', body: JSON.stringify({ ticketId, message }) });
  }

  uploadTicketFile(ticketId: number, file: File) {
    const data = new FormData();
    data.append('file', file);
    return this.request(`/attachments/tickets/${ticketId}`, { method: 'POST', body: data });
  }

  uploadMessageFile(ticketId: number, messageId: number, file: File) {
    const data = new FormData();
    data.append('file', file);
    return this.request(`/attachments/tickets/${ticketId}/messages/${messageId}`, { method: 'POST', body: data });
  }

  notifications() {
    return this.request<NotificationItem[]>('/notifications');
  }

  markNotificationRead(id: number) {
    return this.request(`/notifications/${id}/read`, { method: 'PATCH' });
  }

  auditLogs() {
    return this.request<AuditLog[]>('/audit-logs?limit=12');
  }
}

export const api = new ApiClient();
