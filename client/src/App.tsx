import {
  Bell,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock3,
  Filter,
  Loader2,
  LogOut,
  MessageSquareText,
  Minus,
  MoreVertical,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  TicketIcon,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { api, uploadUrl } from './lib/api';
import { disconnectSocket, getSocket } from './lib/socket';
import type {
  Attachment,
  AuditLog,
  Category,
  NotificationItem,
  Ticket,
  TicketMessage,
  TicketPriority,
  TicketStats,
  TicketStatus,
  TicketWorkflowLog,
  User,
} from './types';

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
  | { id: string; kind: 'ticketAttachment'; at: string; attachment: Attachment }
  | { id: string; kind: 'message'; at: string; message: TicketMessage };

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<TicketStats>(emptyStats);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [view, setView] = useState<'dashboard' | 'create' | 'detail'>('dashboard');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  if (loading) {
    return (
      <main className="boot">
        <Loader2 className="spin" />
      </main>
    );
  }

  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><TicketIcon size={22} /></div>
          <div>
            <strong>Task Ticketing</strong>
            <span>{user.role}</span>
          </div>
        </div>

        <nav className="nav-list">
          <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>
            <CircleDot size={18} /> Dashboard
          </button>
          <button className={view === 'create' ? 'active' : ''} onClick={() => setView('create')}>
            <Plus size={18} /> Buat Tiket
          </button>
        </nav>

        <div className="profile">
          <UserRound size={18} />
          <div>
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <button className="icon-button" title="Logout" onClick={logout}>
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <h1>{view === 'create' ? 'Buat Tiket Baru' : view === 'detail' ? selectedTicket?.ticketNumber : 'Dashboard Tiket'}</h1>
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
          />
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

function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState('admin@demo.test');
  const [password, setPassword] = useState('password123');
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
    <main className="login-page">
      <section className="login-panel">
        <div className="brand login-brand">
          <div className="brand-mark"><ShieldCheck size={24} /></div>
          <div>
            <strong>Portal Task Ticketing</strong>
            <span>Support desk realtime</span>
          </div>
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
        <div className="demo-row">
          {['admin@demo.test', 'support@demo.test', 'customer@demo.test'].map((mail) => (
            <button key={mail} type="button" onClick={() => setEmail(mail)}>
              {mail.split('@')[0]}
            </button>
          ))}
        </div>
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
}: {
  stats: TicketStats;
  tickets: Ticket[];
  query: string;
  setQuery: (value: string) => void;
  onSelect: (ticket: Ticket) => void;
  onCreate: () => void;
  auditLogs: AuditLog[];
  isAdmin: boolean;
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
    <section className="dashboard-grid">
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
                  <strong>{ticket.title}</strong>
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
      ...(ticket.attachments ?? [])
        .filter((attachment) => !attachment.messageId)
        .map((attachment) => ({
          id: `ticket-attachment-${attachment.id}`,
          kind: 'ticketAttachment' as const,
          at: attachment.uploadedAt,
          attachment,
        })),
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

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!canReply) return;
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
        <div className="detail-head">
          <button className="ghost-button" onClick={onBack}>Kembali</button>
          <div>
            <h2>{ticket.title}</h2>
            <span>{ticket.ticketNumber} - {ticket.category?.name}</span>
          </div>
          <StatusBadge status={ticket.status} />
        </div>

        <p className="description">{ticket.description}</p>

        <div className="message-panel conversation-panel">
          <div className="message-title conversation-title">
            <MessageSquareText size={19} />
            <strong>Diskusi</strong>
          </div>
          <div className="conversation-timeline">
            {timelineItems.map((item) => {
              if (item.kind === 'created') {
                return (
                  <div className="activity-line" key={item.id}>
                    <span>{ticket.customer?.name ?? 'Customer'} membuat tiket</span>
                    <time>{new Date(item.at).toLocaleString('id-ID')}</time>
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
              if (item.kind === 'ticketAttachment') {
                return (
                  <div className="conversation-entry" key={item.id}>
                    <article className="message-card attachment-bubble">
                      <header className="message-card-head">
                        <strong>Lampiran tiket</strong>
                        <time>{new Date(item.at).toLocaleString('id-ID')}</time>
                      </header>
                      <div className="message-card-body">
                        <p>Lampiran pendukung tiket.</p>
                      </div>
                      <AttachmentLink attachment={item.attachment} />
                    </article>
                  </div>
                );
              }
              const isMine = item.message.senderId === currentUser.id;
              const senderRole = item.message.sender?.role ?? 'customer';
              return (
                <div className={`conversation-entry ${isMine ? 'mine' : 'other'} role-${senderRole}`} key={item.id}>
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
                placeholder="Type a message..."
                rows={4}
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
