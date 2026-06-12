export enum UserRole {
  Customer = 'customer',
  Support = 'support',
  Admin = 'admin',
}

export enum UserStatus {
  Active = 'active',
  Inactive = 'inactive',
}

export enum TicketPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical',
}

export enum TicketStatus {
  Open = 'open',
  Assigned = 'assigned',
  InProgress = 'in_progress',
  WaitingCustomer = 'waiting_customer',
  Solved = 'solved',
  Closed = 'closed',
}
