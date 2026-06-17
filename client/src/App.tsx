import {
  Bell,
  Camera,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock3,
  Filter,
  Loader2,
  LogOut,
  Menu,
  MessageSquareText,
  Minus,
  Moon,
  MoreVertical,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sun,
  TicketIcon,
  Trash2,
  Upload,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import { api, uploadUrl } from './lib/api';
import { disconnectSocket, getSocket } from './lib/socket';
import type {
  Attachment,
  AuditLog,
  Category,
  NotificationItem,
  Role,
  Ticket,
  TicketMessage,
  TicketPriority,
  TicketStats,
  TicketStatus,
  TicketWorkflowLog,
  User,
} from './types';

type AppView = 'dashboard' | 'create' | 'detail' | 'users' | 'password';
type ThemeMode = 'light' | 'dark';

const statusLabels: Record<TicketStatus, string> = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  waiting_customer: 'Waiting Customer',
  solved: 'Solved',
  closed: 'Closed',
};

const priorities: TicketPriority[] = ['low', 'medium', 'high', 'critical'];
const statuses: TicketStatus[] = ['open', 'assigned', 'in_progress', 'waiting_customer', 'solved', 'closed'];

const emptyStats: TicketStats = {
  total: 0,
  byStatus: { open: 0, assigned: 0, in_progress: 0, waiting_customer: 0, solved: 0, closed: 0 },
  latest: [],
};

type TimelineItem =
  | { id: string; kind: 'created'; at: string }
  | { id: string; kind: 'workflow'; at: string; log: TicketWorkflowLog }
  | { id: string; kind: 'workflowFallback'; at: string }
  | { id: string; kind: 'message'; at: string; message: TicketMessage };

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof localStorage === 'undefined') return 'light';
    return localStorage.getItem('ticketing_theme') === 'dark' ? 'dark' : 'light';
  });
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<TicketStats>(emptyStats);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [view, setView] = useState<AppView>('dashboard');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    localStorage.setItem('ticketing_theme', theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const refresh = async () => {
    if (!api.getToken()) return;
    const [ticketRows, statRows, categoryRows, notificationRows] = await Promise.all([
      api.tickets(),
      api.stats(),
      api.categories(),
      api.notifications(),
    ]);
    setTickets(ticketRows);
    setStats(statRows);
    setCategories(categoryRows);
    setNotifications(notificationRows);
    if (user?.role === 'admin') {
      const [userRows, auditRows] = await Promise.all([api.users(), api.auditLogs()]);
      setUsers(userRows);
      setAuditLogs(auditRows);
    }
  };

  useEffect(() => {
    async function bootstrap() {
      const token = api.getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const me = await api.me();
        setUser(me);
      } catch {
        api.setToken(null);
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, []);

  useEffect(() => {
    if (!user) return;
    refresh().catch((err) => setError(err.message));
  }, [user]);

  useEffect(() => {
    const token = api.getToken();
    if (!user || !token) return;
    const socket = getSocket(token);
    const onNotification = (item: NotificationItem) => setNotifications((current) => [item, ...current].slice(0, 30));
    const onTicketUpdate = (ticket: Ticket) => {
      setTickets((current) => current.map((row) => (row.id === ticket.id ? ticket : row)));
      setSelectedTicket((current) => (current?.id === ticket.id ? ticket : current));
      refresh().catch(() => undefined);
    };
    const onTicketChanged = () => {
      refresh().catch(() => undefined);
      if (selectedTicket) {
        api.ticket(selectedTicket.id).then(setSelectedTicket).catch(() => undefined);
      }
    };
    const onMessage = () => {
      if (selectedTicket) {
        api.ticket(selectedTicket.id).then(setSelectedTicket).catch(() => undefined);
      }
    };
    const onAttachment = onMessage;

    socket.on('notification:new', onNotification);
    socket.on('ticket:updated', onTicketUpdate);
    socket.on('ticket:changed', onTicketChanged);
    socket.on('message:new', onMessage);
    socket.on('attachment:new', onAttachment);
    return () => {
      socket.off('notification:new', onNotification);
      socket.off('ticket:updated', onTicketUpdate);
      socket.off('ticket:changed', onTicketChanged);
      socket.off('message:new', onMessage);
      socket.off('attachment:new', onAttachment);
    };
  }, [user, selectedTicket?.id]);

  async function selectTicket(ticket: Ticket) {
    setError('');
    const detail = await api.ticket(ticket.id);
    setSelectedTicket(detail);
    setView('detail');
    const unreadTicketNotifications = notifications.filter((item) => !item.isRead && item.ticketId === ticket.id);
    if (unreadTicketNotifications.length) {
      setNotifications((current) =>
        current.map((item) => (item.ticketId === ticket.id ? { ...item, isRead: true } : item)),
      );
      Promise.allSettled(unreadTicketNotifications.map((item) => api.markNotificationRead(item.id))).catch(() => undefined);
    }
    const token = api.getToken();
    if (token) getSocket(token).emit('ticket:join', ticket.id);
  }

  async function openNotification(notification: NotificationItem) {
    setError('');
    setNotifications((current) =>
      current.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)),
    );
    setNotificationsOpen(false);
    try {
      await api.markNotificationRead(notification.id);
      const ticketNumber = notification.body.match(/TCK-\d{8}-\d{5}/)?.[0];
      const fallbackTicketId = ticketNumber ? tickets.find((ticket) => ticket.ticketNumber === ticketNumber)?.id : undefined;
      const targetTicketId = notification.ticketId ?? fallbackTicketId;
      if (targetTicketId) {
        const ticket = await api.ticket(targetTicketId);
        await selectTicket(ticket);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuka notifikasi');
    }
  }

  function logout() {
    api.setToken(null);
    disconnectSocket();
    setUser(null);
    setTickets([]);
    setSelectedTicket(null);
    setView('dashboard');
    setMobileSidebarOpen(false);
  }

  function toggleSidebar() {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 980px)').matches) {
      setMobileSidebarOpen((open) => !open);
      return;
    }
    setSidebarCollapsed((collapsed) => !collapsed);
  }

  function navigate(nextView: AppView) {
    setView(nextView);
    setMobileSidebarOpen(false);
  }

  const filteredTickets = useMemo(() => {
    const term = query.toLowerCase().trim();
    if (!term) return tickets;
    return tickets.filter((ticket) =>
      [ticket.ticketNumber, ticket.title, ticket.customer?.name, ticket.category?.name, ticket.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [tickets, query]);
  const unreadByTicketId = useMemo(
    () =>
      notifications.reduce<Record<number, number>>((acc, item) => {
        const isMessageNotification = item.title.toLowerCase().includes('pesan');
        if (!item.isRead && item.ticketId && isMessageNotification) {
          acc[item.ticketId] = (acc[item.ticketId] ?? 0) + 1;
        }
        return acc;
      }, {}),
    [notifications],
  );

  if (loading) {
    return (
      <main className="boot">
        <Loader2 className="spin" />
      </main>
    );
  }

  if (!user) {
    return <LoginPage onLogin={setUser} theme={theme} setTheme={setTheme} />;
  }

  return (
    <div className={`app-shell theme-${theme} ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${mobileSidebarOpen ? 'sidebar-mobile-open' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-head">
          <button
            className="brand brand-button"
            type="button"
            title={sidebarCollapsed ? 'Buka sidebar' : 'Tutup sidebar'}
            onClick={toggleSidebar}
          >
            <span className="brand-mark"><TicketIcon size={22} /></span>
            <span className="brand-copy">
              <strong>Task Ticketing</strong>
              <span>{user.role}</span>
            </span>
          </button>
          <button
            className="mobile-nav-button"
            type="button"
            title={mobileSidebarOpen ? 'Tutup menu' : 'Buka menu'}
            onClick={() => setMobileSidebarOpen((open) => !open)}
          >
            {mobileSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <div className="sidebar-content">
          <nav className="nav-list">
            <button className={view === 'dashboard' ? 'active' : ''} onClick={() => navigate('dashboard')}>
              <CircleDot size={18} /> <span>{user.role === 'customer' ? 'Tiket Saya' : 'Dashboard'}</span>
            </button>
            <button className={view === 'create' ? 'active' : ''} onClick={() => navigate('create')}>
              <Plus size={18} /> <span>Buat Tiket</span>
            </button>
            {user.role === 'admin' && (
              <button className={view === 'users' ? 'active' : ''} onClick={() => navigate('users')}>
                <Users size={18} /> <span>Users</span>
              </button>
            )}
            <button className={view === 'password' ? 'active' : ''} onClick={() => navigate('password')}>
              <ShieldCheck size={18} /> <span>Change Password</span>
            </button>
          </nav>

          <ThemeSwitch theme={theme} setTheme={setTheme} />

          <div className="profile">
            <UserRound size={18} />
            <div className="profile-copy">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
            <button className="icon-button" title="Logout" onClick={logout}>
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <main className="workspace">
        {view !== 'detail' && (
        <header className="topbar">
          <div>
            <h1>
              {view === 'create'
                ? 'Buat Tiket Baru'
                : view === 'users'
                  ? 'User Portal'
                  : view === 'password'
                    ? 'Change Password'
                    : user.role === 'customer'
                      ? 'Tiket Saya'
                      : 'Dashboard Tiket'}
            </h1>
            <p>{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
          </div>
          <div className="top-actions">
            <button className="icon-button" title="Refresh" onClick={() => refresh().catch((err) => setError(err.message))}>
              <RefreshCw size={18} />
            </button>
            <div className="notification-menu">
              <button
                className="notification-pill"
                title="Notifikasi"
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <Bell size={17} />
                <span>{notifications.filter((item) => !item.isRead).length}</span>
              </button>
              {notificationsOpen && (
                <div className="notification-dropdown">
                  <strong>Notifikasi</strong>
                  <div className="notification-list">
                    {notifications.map((item) => (
                      <button
                        className={`notification-item ${item.isRead ? '' : 'unread'}`}
                        key={item.id}
                        onClick={() => openNotification(item)}
                      >
                        <span>{item.title}</span>
                        <p>{item.body}</p>
                        <small>{new Date(item.createdAt).toLocaleString('id-ID')}</small>
                      </button>
                    ))}
                    {!notifications.length && <div className="notification-empty">Belum ada notifikasi.</div>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        )}

        {error && <div className="alert">{error}</div>}

        {view === 'dashboard' && (
          <Dashboard
            stats={stats}
            tickets={filteredTickets}
            query={query}
            setQuery={setQuery}
            onSelect={selectTicket}
            onCreate={() => setView('create')}
            auditLogs={auditLogs}
            isAdmin={user.role === 'admin'}
            isCustomer={user.role === 'customer'}
            unreadByTicketId={unreadByTicketId}
          />
        )}
        {view === 'users' && user.role === 'admin' && (
          <UserManagement
            users={users}
            currentUser={user}
            onChanged={() => refresh().catch((err) => setError(err.message))}
            onError={setError}
          />
        )}
        {view === 'password' && (
          <ChangePasswordPanel onError={setError} />
        )}
        {view === 'create' && (
          <TicketForm
            categories={categories}
            users={users}
            currentUser={user}
            onCreated={async (ticket) => {
              await refresh();
              await selectTicket(ticket);
            }}
            onError={setError}
          />
        )}
        {view === 'detail' && selectedTicket && (
          <TicketDetail
            ticket={selectedTicket}
            currentUser={user}
            users={users}
            onBack={() => setView('dashboard')}
            onUpdated={(ticket) => {
              setSelectedTicket(ticket);
              refresh().catch(() => undefined);
            }}
            onError={setError}
          />
        )}
      </main>
    </div>
  );
}

function ThemeSwitch({ theme, setTheme }: { theme: ThemeMode; setTheme: (theme: ThemeMode) => void }) {
  const isDark = theme === 'dark';

  return (
    <button
      className={`theme-switch ${isDark ? 'active' : ''}`}
      type="button"
      title={isDark ? 'Gunakan light mode' : 'Gunakan dark mode'}
      aria-label={isDark ? 'Gunakan light mode' : 'Gunakan dark mode'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      <span className="theme-switch-track">
        <span className="theme-switch-thumb">
          {isDark ? <Moon size={15} /> : <Sun size={15} />}
        </span>
      </span>
      <span className="theme-switch-copy">{isDark ? 'Dark mode' : 'Light mode'}</span>
    </button>
  );
}

function LoginPage({
  onLogin,
  theme,
  setTheme,
}: {
  onLogin: (user: User) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api.login(email, password);
      api.setToken(result.accessToken);
      onLogin(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={`login-page theme-${theme}`}>
      <section className="login-panel">
        <div className="login-head">
          <div className="brand login-brand">
            <div className="brand-mark"><ShieldCheck size={24} /></div>
            <div>
              <strong>Portal Task Ticketing</strong>
              <span>Support desk realtime</span>
            </div>
          </div>
          <ThemeSwitch theme={theme} setTheme={setTheme} />
        </div>
        <form onSubmit={submit} className="form-stack">
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" />
          </label>
          <label>
            Password
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
          </label>
          {error && <div className="alert">{error}</div>}
          <button className="primary-button" disabled={busy}>
            {busy ? <Loader2 className="spin" size={18} /> : <LogOut size={18} />}
            Login
          </button>
        </form>
      </section>
      <section className="login-art">
        <h2>Ticket lifecycle, chat, upload, audit, dan notifikasi dalam satu portal.</h2>
        <div className="status-strip">
          <span>Open</span><span>Assigned</span><span>In Progress</span><span>Solved</span><span>Closed</span>
        </div>
      </section>
    </main>
  );
}

function Dashboard({
  stats,
  tickets,
  query,
  setQuery,
  onSelect,
  onCreate,
  auditLogs,
  isAdmin,
  isCustomer,
  unreadByTicketId,
}: {
  stats: TicketStats;
  tickets: Ticket[];
  query: string;
  setQuery: (value: string) => void;
  onSelect: (ticket: Ticket) => void;
  onCreate: () => void;
  auditLogs: AuditLog[];
  isAdmin: boolean;
  isCustomer: boolean;
  unreadByTicketId: Record<number, number>;
}) {
  const [activeStatus, setActiveStatus] = useState<TicketStatus | 'all'>('all');
  const cards = [
    { label: 'Open', value: stats.byStatus.open, icon: CircleDot },
    { label: 'In Progress', value: stats.byStatus.in_progress, icon: Clock3 },
    { label: 'Solved', value: stats.byStatus.solved, icon: CheckCircle2 },
    { label: 'Closed', value: stats.byStatus.closed, icon: ShieldCheck },
  ];
  const statusTabs = [
    { value: 'all' as const, label: 'All tickets', count: tickets.length },
    ...statuses.map((status) => ({
      value: status,
      label: statusLabels[status],
      count: tickets.filter((ticket) => ticket.status === status).length,
    })),
  ];
  const visibleTickets = activeStatus === 'all' ? tickets : tickets.filter((ticket) => ticket.status === activeStatus);

  return (
    <section className={`dashboard-grid ${isCustomer ? 'customer-dashboard' : ''}`}>
      {!isCustomer && (
      <div className="stat-row">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article className="stat-card" key={card.label}>
              <Icon size={20} />
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </article>
          );
        })}
      </div>
      )}

      <div className="ticket-board">
        <div className="ticket-board-toolbar">
          <button className="primary-button compact" onClick={onCreate}>
            <Plus size={18} /> New ticket
          </button>
          <div className="search-box">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search requester" />
          </div>
          <button className="filter-button" type="button">
            <Filter size={16} /> Filters <ChevronDown size={15} />
          </button>
        </div>
        <div className="ticket-tabs">
          {statusTabs.map((tab) => (
            <button
              className={activeStatus === tab.value ? 'active' : ''}
              key={tab.value}
              onClick={() => setActiveStatus(tab.value)}
              type="button"
            >
              {tab.label} <span>({tab.count})</span>
            </button>
          ))}
        </div>
        <div className="ticket-table" role="table" aria-label="Daftar tiket">
          <div className="ticket-table-head" role="row">
            <span className="select-cell"><input aria-label="Pilih semua tiket" type="checkbox" /></span>
            <span>ID</span>
            <span>Requester</span>
            <span>Priority</span>
            <span>Subject</span>
            <span>Status</span>
            <span></span>
          </div>
          <div className="ticket-table-body">
            {visibleTickets.map((ticket) => (
              <button className="ticket-table-row" key={ticket.id} onClick={() => onSelect(ticket)} role="row">
                <span className="select-cell">
                  <input aria-label={`Pilih ${ticket.ticketNumber}`} onClick={(event) => event.stopPropagation()} type="checkbox" />
                </span>
                <span className="ticket-id">{ticketShortId(ticket)}</span>
                <span className="requester-cell">
                  <span className="requester-avatar">{initials(ticket.customer?.name ?? ticket.title)}</span>
                  <span className="requester-copy">
                    <strong>{ticket.customer?.name ?? 'Unknown'}</strong>
                    <small>User: {ticket.customer?.email ?? ticket.category?.name}</small>
                  </span>
                </span>
                <span className="priority-cell">
                  <PriorityIndicator priority={ticket.priority} />
                  <span>{priorityLabel(ticket.priority)}</span>
                </span>
                <span className="subject-cell">
                  <strong>
                    <span className="ticket-subject-title">{ticket.title}</span>
                    {!!unreadByTicketId[ticket.id] && (
                      <span className="ticket-unread-badge" aria-label={`${unreadByTicketId[ticket.id]} pesan belum dibaca`}>
                        {unreadByTicketId[ticket.id]}
                      </span>
                    )}
                  </strong>
                  <small>{ticket.category?.name} - {new Date(ticket.updatedAt).toLocaleDateString('id-ID')}</small>
                </span>
                <span className="status-cell">
                  <StatusBadge status={ticket.status} />
                </span>
                <span className="row-action">
                  <MoreVertical size={18} />
                </span>
              </button>
            ))}
          </div>
          {!visibleTickets.length && <div className="empty-state">Belum ada tiket.</div>}
        </div>
      </div>

      {isAdmin && <TicketCharts tickets={tickets} />}

      {isAdmin && (
        <div className="list-panel audit-panel">
          <div className="message-title">
            <ShieldCheck size={18} />
            <strong>Audit Trail</strong>
          </div>
          <div className="audit-list">
            {auditLogs.map((log) => (
              <div className="audit-row" key={log.id}>
                <span>{log.user?.name ?? 'System'}</span>
                <strong>{log.activity}</strong>
                <small>{new Date(log.createdAt).toLocaleString('id-ID')}</small>
              </div>
            ))}
            {!auditLogs.length && <div className="empty-state">Belum ada aktivitas.</div>}
          </div>
        </div>
      )}
    </section>
  );
}

function TicketCharts({ tickets }: { tickets: Ticket[] }) {
  const statusData = statuses.map((status) => ({
    label: statusLabels[status],
    value: tickets.filter((ticket) => ticket.status === status).length,
  }));
  const priorityData = priorities.map((priority) => ({
    label: priorityLabel(priority),
    value: tickets.filter((ticket) => ticket.priority === priority).length,
  }));
  const maxValue = Math.max(1, ...statusData.map((item) => item.value), ...priorityData.map((item) => item.value));

  return (
    <div className="ticket-charts">
      <ChartPanel title="Ticket by Status" data={statusData} maxValue={maxValue} />
      <ChartPanel title="Ticket by Priority" data={priorityData} maxValue={maxValue} />
    </div>
  );
}

function ChartPanel({ title, data, maxValue }: { title: string; data: { label: string; value: number }[]; maxValue: number }) {
  return (
    <section className="chart-panel">
      <div className="message-title">
        <CircleDot size={17} />
        <strong>{title}</strong>
      </div>
      <div className="bar-chart">
        {data.map((item) => (
          <div className="bar-row" key={item.label}>
            <span>{item.label}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${Math.max(5, (item.value / maxValue) * 100)}%` }} />
            </div>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function UserManagement({
  users,
  currentUser,
  onChanged,
  onError,
}: {
  users: User[];
  currentUser: User;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const roles: Role[] = ['admin', 'support', 'customer'];
  const statuses = ['active', 'inactive'];
  const [editing, setEditing] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('customer');
  const [status, setStatus] = useState('active');
  const [password, setPassword] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<number | 'all'>(10);
  const [busy, setBusy] = useState(false);
  const filteredUsers = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return users;
    return users.filter((item) =>
      [item.name, item.email, item.role, item.status].some((value) => value.toLowerCase().includes(term)),
    );
  }, [users, filter]);
  const totalPages = perPage === 'all' ? 1 : Math.max(1, Math.ceil(filteredUsers.length / perPage));
  const safePage = Math.min(page, totalPages);
  const visibleUsers = perPage === 'all'
    ? filteredUsers
    : filteredUsers.slice((safePage - 1) * perPage, safePage * perPage);
  const rangeStart = filteredUsers.length ? (perPage === 'all' ? 1 : (safePage - 1) * perPage + 1) : 0;
  const rangeEnd = perPage === 'all' ? filteredUsers.length : Math.min(filteredUsers.length, safePage * perPage);

  function resetForm() {
    setEditing(null);
    setModalOpen(false);
    setName('');
    setEmail('');
    setRole('customer');
    setStatus('active');
    setPassword('');
  }

  function openCreate() {
    resetForm();
    setModalOpen(true);
  }

  function edit(user: User) {
    setEditing(user);
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setStatus(user.status);
    setPassword('');
    setModalOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    onError('');
    try {
      if (editing) {
        await api.updateUser(editing.id, {
          name,
          email,
          role,
          status,
          ...(password ? { password } : {}),
        });
      } else {
        await api.createUser({ name, email, role, password });
      }
      resetForm();
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal menyimpan user');
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhoto(user: User, fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setBusy(true);
    onError('');
    try {
      await api.uploadUserPhoto(user.id, file);
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal upload foto');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusy(true);
    onError('');
    try {
      await api.deleteUser(deleteTarget.id);
      if (editing?.id === deleteTarget.id) resetForm();
      setDeleteTarget(null);
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal menghapus user');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setPage(1);
  }, [filter, perPage]);

  return (
    <section className="user-admin-grid">
      <div className="list-panel user-list-panel">
        <div className="user-toolbar">
          <div className="message-title">
            <Users size={18} />
            <strong>Daftar User</strong>
          </div>
          <button className="primary-button compact" type="button" onClick={openCreate}>
            <Plus size={17} /> Tambah User
          </button>
        </div>
        <div className="user-filter-row">
          <div className="search-box user-search">
            <Search size={18} />
            <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter nama, email, role, status" />
          </div>
          <label className="page-size-control">
            Show
            <select
              value={perPage}
              onChange={(event) => setPerPage(event.target.value === 'all' ? 'all' : Number(event.target.value))}
            >
              <option value={10}>10</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value="all">All</option>
            </select>
          </label>
        </div>
        <div className="user-list">
          {visibleUsers.map((item) => (
            <article className="user-row" key={item.id}>
              <UserAvatar user={item} />
              <div className="user-row-copy">
                <strong>{item.name}</strong>
                <span>{item.email}</span>
                <small>{item.role} - {item.status}</small>
              </div>
              <div className="user-row-actions">
                <label className="icon-button" title="Upload foto">
                  <Camera size={17} />
                  <input type="file" accept="image/*" onChange={(event) => uploadPhoto(item, event.target.files)} />
                </label>
                <button className="icon-button" type="button" title="Edit user" onClick={() => edit(item)}>
                  <UserRound size={17} />
                </button>
                <button
                  className="icon-button danger"
                  type="button"
                  title="Delete user"
                  disabled={item.id === currentUser.id || busy}
                  onClick={() => setDeleteTarget(item)}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </article>
          ))}
          {!visibleUsers.length && <div className="empty-state">Belum ada user.</div>}
        </div>
        <div className="pagination-bar">
          <span>{rangeStart}-{rangeEnd} of {filteredUsers.length}</span>
          <div className="pagination-actions">
            <button className="ghost-button compact" type="button" disabled={safePage <= 1 || perPage === 'all'} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              Prev
            </button>
            <strong>Page {safePage}/{totalPages}</strong>
            <button className="ghost-button compact" type="button" disabled={safePage >= totalPages || perPage === 'all'} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
              Next
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-card user-modal" onSubmit={submit}>
            <div className="modal-head">
              <div className="message-title">
                <Users size={18} />
                <strong>{editing ? 'Edit User' : 'Tambah User'}</strong>
              </div>
              <button className="icon-button mini" type="button" title="Tutup" onClick={resetForm}>
                <X size={16} />
              </button>
            </div>
            <div className="form-grid">
              <label>
                Nama
                <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} />
              </label>
              <label>
                Email
                <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required maxLength={160} />
              </label>
              <label>
                Role
                <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
                  {roles.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label>
                Status
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </div>
            <label>
              Password {editing ? '(kosongkan jika tidak diganti)' : ''}
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                required={!editing}
                minLength={8}
                autoComplete="new-password"
              />
            </label>
            <div className="form-actions">
              <button className="primary-button" disabled={busy}>
                {busy ? <Loader2 className="spin" size={18} /> : <CheckCircle2 size={18} />}
                {editing ? 'Simpan User' : 'Tambah User'}
              </button>
              <button className="ghost-button" type="button" onClick={resetForm}>
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card delete-modal">
            <div className="modal-head">
              <div className="message-title">
                <Trash2 size={18} />
                <strong>Delete User</strong>
              </div>
              <button className="icon-button mini" type="button" title="Tutup" onClick={() => setDeleteTarget(null)}>
                <X size={16} />
              </button>
            </div>
            <p>Hapus user <strong>{deleteTarget.name}</strong>? User tidak bisa login lagi setelah dihapus.</p>
            <div className="form-actions">
              <button className="primary-button danger-action" type="button" disabled={busy} onClick={remove}>
                {busy ? <Loader2 className="spin" size={18} /> : <Trash2 size={18} />}
                Delete
              </button>
              <button className="ghost-button" type="button" onClick={() => setDeleteTarget(null)}>
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function UserAvatar({ user }: { user: User }) {
  if (user.avatarPath) {
    return <img className="user-avatar" src={uploadUrl(user.avatarPath)} alt={user.name} />;
  }
  return <span className="user-avatar fallback">{initials(user.name)}</span>;
}

function ChangePasswordPanel({ onError }: { onError: (message: string) => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSuccess('');
    onError('');
    if (newPassword !== confirmPassword) {
      onError('Konfirmasi password tidak sama');
      return;
    }
    setBusy(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Password berhasil diganti.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal mengganti password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="ticket-form password-form" onSubmit={submit}>
      <div className="message-title">
        <ShieldCheck size={18} />
        <strong>Change Password</strong>
      </div>
      <label>
        Password saat ini
        <input value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} type="password" required autoComplete="current-password" />
      </label>
      <label>
        Password baru
        <input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} type="password" required minLength={8} autoComplete="new-password" />
      </label>
      <label>
        Konfirmasi password baru
        <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" required minLength={8} autoComplete="new-password" />
      </label>
      {success && <div className="success-note">{success}</div>}
      <button className="primary-button" disabled={busy}>
        {busy ? <Loader2 className="spin" size={18} /> : <ShieldCheck size={18} />}
        Simpan Password
      </button>
    </form>
  );
}

function TicketForm({
  categories,
  users,
  currentUser,
  onCreated,
  onError,
}: {
  categories: Category[];
  users: User[];
  currentUser: User;
  onCreated: (ticket: Ticket) => void;
  onError: (message: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? 0);
  const [customerId, setCustomerId] = useState<number | undefined>();
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!categoryId && categories[0]) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    onError('');
    try {
      const ticket = await api.createTicket({
        title,
        categoryId,
        customerId: currentUser.role === 'customer' ? undefined : customerId,
        priority,
        description,
      });
      if (file) await api.uploadTicketFile(ticket.id, file);
      onCreated(ticket);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal membuat tiket');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="ticket-form" onSubmit={submit}>
      <div className="form-grid">
        <label>
          Judul tiket
          <input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={180} />
        </label>
        <label>
          Kategori
          <select value={categoryId} onChange={(event) => setCategoryId(Number(event.target.value))} required>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        {currentUser.role !== 'customer' && (
          <label>
            Customer
            <select value={customerId ?? ''} onChange={(event) => setCustomerId(Number(event.target.value) || undefined)}>
              <option value="">Gunakan akun saya</option>
              {users.filter((item) => item.role === 'customer').map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          Prioritas
          <select value={priority} onChange={(event) => setPriority(event.target.value as TicketPriority)}>
            {priorities.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>
      <label>
        Deskripsi kendala
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} required rows={8} />
      </label>
      <label className="file-drop">
        <Upload size={20} />
        <span>{file ? file.name : 'Lampiran JPG, PNG, GIF, PDF, DOCX, XLSX'}</span>
        <input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      </label>
      <button className="primary-button" disabled={busy || !categoryId}>
        {busy ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
        Submit Tiket
      </button>
    </form>
  );
}

function TicketDetail({
  ticket,
  currentUser,
  users,
  onBack,
  onUpdated,
  onError,
}: {
  ticket: Ticket;
  currentUser: User;
  users: User[];
  onBack: () => void;
  onUpdated: (ticket: Ticket) => void;
  onError: (message: string) => void;
}) {
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const canManage = currentUser.role === 'admin' || currentUser.role === 'support';
  const canClose = (currentUser.role === 'admin' || currentUser.id === ticket.customerId) && ticket.status === 'solved';
  const canReply = ticket.status !== 'closed';
  const selectedFiles = useMemo(
    () =>
      files.map((file) => ({
        file,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      })),
    [files],
  );
  const timelineItems = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [
      { id: 'ticket-created', kind: 'created', at: ticket.createdAt },
      ...(ticket.messages ?? []).map((item) => ({
        id: `message-${item.id}`,
        kind: 'message' as const,
        at: item.createdAt,
        message: item,
      })),
      ...(ticket.workflowLogs ?? []).map((log) => ({
        id: `workflow-${log.id}`,
        kind: 'workflow' as const,
        at: log.createdAt,
        log,
      })),
    ];

    if (ticket.status !== 'open' && !ticket.workflowLogs?.length) {
      items.push({ id: 'workflow-fallback', kind: 'workflowFallback', at: ticket.updatedAt });
    }

    return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [ticket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timelineItems.length]);

  useEffect(() => {
    return () => {
      selectedFiles.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, [selectedFiles]);

  useEffect(() => {
    setFiles([]);
    setMessage('');
  }, [ticket.id]);

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const nextFiles = Array.from(fileList).filter((item) => item.type.startsWith('image/'));
    setFiles((current) => [...current, ...nextFiles]);
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function submitMessage() {
    if (!canReply) return;
    if (busy) return;
    if (!message.trim() && !files.length) return;
    setBusy(true);
    onError('');
    try {
      const fallbackMessage = `Lampiran: ${files.map((item) => item.name).join(', ')}`;
      const sentMessage = await api.sendMessage(ticket.id, message.trim() || fallbackMessage);
      for (const item of files) {
        await api.uploadMessageFile(ticket.id, sentMessage.id, item);
      }
      setMessage('');
      setFiles([]);
      onUpdated(await api.ticket(ticket.id));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal mengirim pesan');
    } finally {
      setBusy(false);
    }
  }

  function send(event: FormEvent) {
    event.preventDefault();
    submitMessage();
  }

  function handleMessageKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      submitMessage();
    }
  }

  function chatSide(senderRole: Role | undefined, senderId: number) {
    if (currentUser.role === 'admin') {
      return senderRole === 'customer' ? 'other' : 'mine';
    }
    return senderId === currentUser.id ? 'mine' : 'other';
  }

  async function patch(payload: { status?: string; assignedTo?: number }) {
    setBusy(true);
    onError('');
    try {
      onUpdated(await api.updateTicket(ticket.id, payload));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal update tiket');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="detail-layout">
      <article className="ticket-main">
        <div className="message-panel conversation-panel">
          <div className="message-title conversation-title">
            <div className="conversation-heading">
              <button className="ghost-button compact" onClick={onBack}>Kembali</button>
              <MessageSquareText size={18} />
              <strong>Diskusi</strong>
            </div>
            <StatusBadge status={ticket.status} />
          </div>
          <div className="conversation-timeline">
            {timelineItems.map((item) => {
              if (item.kind === 'created') {
                const side = chatSide('customer', ticket.customerId);
                const ticketAttachments = (ticket.attachments ?? []).filter((attachment) => !attachment.messageId);
                return (
                  <div className={`conversation-entry ticket-origin ${side} role-customer`} key={item.id}>
                    <article className="message-card role-customer">
                      <header className="message-card-head">
                        <strong>{ticket.customer?.name ?? 'Customer'}</strong>
                        <time>{new Date(item.at).toLocaleString('id-ID')}</time>
                      </header>
                      <div className="message-card-body">
                        <span className="ticket-origin-label">Deskripsi kendala</span>
                        <p>{ticket.description}</p>
                      </div>
                      {!!ticketAttachments.length && (
                        <div className="message-attachments ticket-origin-attachments">
                          {ticketAttachments.map((attachment) => (
                            <AttachmentLink attachment={attachment} key={attachment.id} />
                          ))}
                        </div>
                      )}
                    </article>
                  </div>
                );
              }
              if (item.kind === 'workflow') {
                return (
                  <div className="activity-line workflow-line" key={item.id}>
                    <span>{item.log.message}</span>
                    <time>{new Date(item.at).toLocaleString('id-ID')}</time>
                  </div>
                );
              }
              if (item.kind === 'workflowFallback') {
                return (
                  <div className="activity-line workflow-line" key={item.id}>
                    <span>Status tiket saat ini {statusLabels[ticket.status]}</span>
                    <time>{new Date(item.at).toLocaleString('id-ID')}</time>
                  </div>
                );
              }
              const senderRole = item.message.sender?.role ?? 'customer';
              const side = chatSide(senderRole, item.message.senderId);
              return (
                <div className={`conversation-entry ${side} role-${senderRole}`} key={item.id}>
                  <article className={`message-card role-${senderRole}`}>
                    <header className="message-card-head">
                      <strong>{item.message.sender?.name}</strong>
                      <time>{new Date(item.at).toLocaleString('id-ID')}</time>
                    </header>
                    <div className="message-card-body">
                      <p>{item.message.message}</p>
                    </div>
                    {!!item.message.attachments?.length && (
                      <div className="message-attachments">
                        {item.message.attachments.map((attachment) => (
                          <AttachmentLink attachment={attachment} key={attachment.id} />
                        ))}
                      </div>
                    )}
                  </article>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
          {canReply ? (
            <form className="reply-box chat-composer" onSubmit={send}>
              {!!selectedFiles.length && (
                <div className="selected-file-list">
                  {selectedFiles.map((item, index) => (
                    <div className="selected-file-preview" key={`${item.file.name}-${item.file.lastModified}-${index}`}>
                      {item.previewUrl ? (
                        <img src={item.previewUrl} alt={item.file.name} />
                      ) : (
                        <div className="selected-file-icon">
                          <Paperclip size={18} />
                        </div>
                      )}
                      <div>
                        <strong>{item.file.name}</strong>
                        <span>{formatFileSize(item.file.size)}</span>
                      </div>
                      <button type="button" className="icon-button mini" title="Hapus lampiran" onClick={() => removeFile(index)}>
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <textarea
                className="chat-input"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={handleMessageKeyDown}
                placeholder="Type a message..."
                rows={2}
              />
              <div className="composer-footer">
                <div className="composer-tools">
                  <label className={`composer-icon chat-file-button ${files.length ? 'has-file' : ''}`} title="Upload image">
                    <Upload size={16} />
                    <span>Upload image</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) => {
                        addFiles(event.target.files);
                        event.target.value = '';
                      }}
                    />
                  </label>
                </div>
                <div className="composer-submit">
                  <button className="primary-button compact" disabled={busy}>
                    {busy ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
                    Submit
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="chat-closed-state">
              <CheckCircle2 size={18} />
              <span>Tiket sudah closed.</span>
            </div>
          )}
        </div>
      </article>

      <aside className="detail-side">
        <div className="ticket-summary">
          <span>Detail Tiket</span>
          <h2>{ticket.title}</h2>
          <strong>{ticket.ticketNumber}</strong>
          <small>{ticket.category?.name}</small>
        </div>
        <InfoRow label="Customer" value={ticket.customer?.name} />
        <InfoRow label="Support PIC" value={ticket.assignee?.name ?? 'Belum assign'} />
        <InfoRow label="Prioritas" value={<PriorityBadge priority={ticket.priority} />} />
        <InfoRow label="Dibuat" value={new Date(ticket.createdAt).toLocaleString('id-ID')} />

        {canManage && (
          <div className="side-block">
            <strong>Workflow</strong>
            <select value={ticket.status} onChange={(event) => patch({ status: event.target.value })} disabled={busy}>
              {statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
            </select>
            {currentUser.role === 'admin' && (
              <select
                value={ticket.assignedTo ?? ''}
                onChange={(event) => patch({ assignedTo: event.target.value ? Number(event.target.value) : undefined })}
                disabled={busy}
              >
                <option value="">Pilih support</option>
                {users.filter((item) => item.role === 'support').map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {canClose && (
          <button className="primary-button success" disabled={busy} onClick={async () => onUpdated(await api.closeTicket(ticket.id))}>
            <CheckCircle2 size={18} /> Close Ticket
          </button>
        )}
      </aside>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ticketShortId(ticket: Ticket) {
  return `#${ticket.id.toString().padStart(3, '0')}`;
}

function initials(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function priorityLabel(priority: TicketPriority) {
  const labels: Record<TicketPriority, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Highest',
  };
  return labels[priority];
}

function PriorityIndicator({ priority }: { priority: TicketPriority }) {
  if (priority === 'low') return <ChevronDown className="priority-icon low" size={15} />;
  if (priority === 'medium') return <Minus className="priority-icon medium" size={15} />;
  return <ChevronDown className={`priority-icon ${priority}`} size={15} />;
}

function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`badge status-${status}`}>{statusLabels[status]}</span>;
}

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return <span className={`priority priority-${priority}`}>{priority}</span>;
}

function AttachmentLink({ attachment }: { attachment: Attachment }) {
  const isImage = attachment.mimeType.startsWith('image/');
  return (
    <a className="attachment-link" href={uploadUrl(attachment.filePath)} target="_blank" rel="noreferrer">
      {isImage ? <img src={uploadUrl(attachment.filePath)} alt={attachment.fileName} /> : <Paperclip size={16} />}
      <span>{attachment.fileName}</span>
    </a>
  );
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
