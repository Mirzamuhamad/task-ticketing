export type Role = 'customer' | 'support' | 'admin';
export type TicketStatus = 'open' | 'assigned' | 'in_progress' | 'waiting_customer' | 'solved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  status: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface Attachment {
  id: number;
  ticketId: number;
  messageId?: number | null;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

export interface TicketMessage {
  id: number;
  ticketId: number;
  senderId: number;
  sender: User;
  message: string;
  replyToId?: number | null;
  attachments?: Attachment[];
  createdAt: string;
}

export interface TicketWorkflowLog {
  id: number;
  ticketId: number;
  actorId?: number | null;
  actor?: User | null;
  type: string;
  fromValue?: string | null;
  toValue?: string | null;
  message: string;
  createdAt: string;
}

export interface Ticket {
  id: number;
  ticketNumber: string;
  title: string;
  categoryId: number;
  category: Category;
  customerId: number;
  customer: User;
  assignedTo?: number | null;
  assignee?: User | null;
  priority: TicketPriority;
  status: TicketStatus;
  description: string;
  closedAt?: string | null;
  messages?: TicketMessage[];
  attachments?: Attachment[];
  workflowLogs?: TicketWorkflowLog[];
  createdAt: string;
  updatedAt: string;
}

export interface TicketStats {
  total: number;
  byStatus: Record<TicketStatus, number>;
  latest: Ticket[];
}

export interface NotificationItem {
  id: number;
  ticketId?: number | null;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: number;
  activity: string;
  ipAddress?: string | null;
  user?: User | null;
  createdAt: string;
}
