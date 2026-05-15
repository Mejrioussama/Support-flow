// =============================================
// SupportFlow - TypeScript Models
// =============================================

// Type aliases for enums (string literal unions for better compatibility)
export type TicketStatus = 'NEW' | 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'PENDING' | 'ESCALATED_MANUAL' | 'ESCALATED_SLA' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'SUPER_CRITICAL';
export type WaitingOn = 'CLIENT' | 'AGENT' | 'MANAGER' | 'THIRD_PARTY';
export type TicketCategory = string;
export type ContractType = 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE';
export type UserRole = 'ADMIN' | 'SUPPORT_MANAGER' | 'SUPPORT_AGENT' | 'CLIENT';
export type SlaLevel = 'PREMIUM' | 'BUSINESS' | 'STANDARD';
export type SupportCategoryCode =
  | 'AUTHENTICATION'
  | 'UI'
  | 'REPORTING'
  | 'NETWORK'
  | 'EMAIL'
  | 'DATABASE'
  | 'SECURITY'
  | 'HARDWARE'
  | 'SOFTWARE'
  | 'GENERAL';
export type AgentSkillType = 'PRIMARY' | 'SECONDARY';
export type SkillMatchType = 'PRIMARY' | 'SECONDARY' | 'FALLBACK' | 'MANAGER_FALLBACK';

// Base interfaces
export interface BaseEntity {
  id: number;
  createdAt?: string;
  updatedAt?: string;
}

// User interfaces
export interface User extends BaseEntity {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  roles?: string[];
  role?: UserRole;
  enabled?: boolean;
  isActive?: boolean;
  lastLogin?: string;
  keycloakId?: string;
  phone?: string;
  avatarUrl?: string;
  clientId?: number;
  clientName?: string;
  assignedTicketsCount?: number;
  primarySkillCode?: string;
  primarySkillLabel?: string;
  secondarySkillCode?: string;
  secondarySkillLabel?: string;
  skills?: AgentSkill[];
}

export interface UserSummary {
  id: number;
  username: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatarUrl?: string;
  activeTickets?: number;
  slaComplianceRate?: number;
  expertiseScore?: number;
  recommendationScore?: number;
  recommendationReason?: string;
  normalizedCategory?: string;
  skillMatchType?: SkillMatchType;
  primarySkillMatch?: boolean;
  secondarySkillMatch?: boolean;
  primarySkillCode?: string;
  secondarySkillCode?: string;
  primarySkillLabel?: string;
  assignmentEligible?: boolean;
  assignmentStatus?: string;
  assignmentStatusLabel?: string;
}

export interface UserCreate {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  password: string;
  roles?: string[];
  role?: UserRole;
  phone?: string;
  isActive?: boolean;
  clientId?: number;
  primarySkillCode?: string;
  secondarySkillCode?: string;
}

export interface UserUpdate {
  email?: string;
  firstName?: string;
  lastName?: string;
  roles?: string[];
  enabled?: boolean;
  role?: UserRole;
  isActive?: boolean;
  phone?: string;
  clientId?: number;
  primarySkillCode?: string;
  secondarySkillCode?: string;
}

export interface AgentSkill {
  id?: number;
  agentId?: number;
  categoryCode: SupportCategoryCode | string;
  categoryLabel: string;
  skillType: AgentSkillType;
}

export interface SupportCategory extends BaseEntity {
  code: SupportCategoryCode | string;
  label: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
}

// Client interfaces
export interface Client extends BaseEntity {
  name?: string;
  companyName?: string;
  code?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  siret?: string;
  website?: string;
  industry?: string;
  contractType?: ContractType;
  slaLevel?: SlaLevel;
  contractStartDate?: string;
  contractEndDate?: string;
  isActive?: boolean;
  active?: boolean;
  notes?: string;
  logoUrl?: string;
  ticketCount?: number;
  usersCount?: number;
  activeTicketsCount?: number;
}

export interface ClientSummary {
  id: number;
  name?: string;
  companyName?: string;
  code?: string;
  email?: string;
  slaLevel?: SlaLevel;
  logoUrl?: string;
}

export interface ClientCreate {
  name?: string;
  companyName?: string;
  code?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  siret?: string;
  website?: string;
  industry?: string;
  contractType?: ContractType;
  slaLevel?: SlaLevel;
  contractStartDate?: string;
  contractEndDate?: string;
  notes?: string;
}

// Ticket interfaces
export interface Ticket extends BaseEntity {
  reference?: string;
  title: string;
  description?: string;
  status: TicketStatus;
  priority: TicketPriority;
  category?: TicketCategory;
  type?: string;
  severity?: string;
  impact?: string;
  score?: number;
  tags?: string[];
  
  // Relationships
  client?: ClientSummary;
  assignedTo?: UserSummary;
  assignee?: UserSummary;
  assignedAgent?: UserSummary;
  createdByUser?: UserSummary;
  
  // SLA fields
  slaHours?: number;
  slaDeadline?: string;
  slaBreached?: boolean;
  slaWarningSent?: boolean;
  slaState?: 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | 'PAUSED' | 'UNKNOWN';
  slaActionRequired?: boolean;
  slaRemainingTime?: string;
  slaPaused?: boolean;
  slaPausedAt?: string;
  slaTotalPausedMinutes?: number;
  slaExtendedMinutes?: number;
  slaExtensionReason?: string;
  slaBusinessHoursOnly?: boolean;
  slaConsumedPercent?: number;
  slaPhase?: 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | 'PAUSED';
  slaCalendarLabel?: string;
  slaOperationalStatus?: string;
  
  // Escalation
  escalationLevel?: number;
  escalationCount?: number;
  lastEscalationAt?: string;
  escalationBlocked?: boolean;
  slaAdjustedMinutes?: number;
  legacyEscalated?: boolean;
  
  // Contact info
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  
  // Timestamps
  assignedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  resolutionTimeMinutes?: number;
  formattedResolutionTime?: string;
  
  // Workflow
  processInstanceId?: string;
  currentTaskId?: string;
  resolutionSummary?: string;
  resolutionDetails?: TicketResolutionDetails;
  archived?: boolean;
  archiveReference?: string;
  normalizedCategory?: string;
  waitingOn?: WaitingOn;
  pendingReason?: string;
  slaPauseReason?: string;
  managerReviewReason?: string;
  resolutionRejectedReason?: string;
  lastCustomerResponseAt?: string;
  nextExpectedAction?: string;
  
  // Satisfaction
  satisfactionRating?: number;
  satisfactionComment?: string;
  
  // Collections
  comments?: Comment[];
  attachments?: Attachment[];
  commentsCount?: number;
  attachmentsCount?: number;
}

export interface TicketCreate {
  title: string;
  description?: string;
  clientId: number;
  priority: TicketPriority;
  category?: TicketCategory;
  type?: string;
  severity?: string;
  impact?: string;
  assignedToId?: number;
  tags?: string[];
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface TicketUpdate {
  title?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  severity?: string;
  impact?: string;
  assignedToId?: number;
  tags?: string[];
  resolutionSummary?: string;
  resolutionDetails?: TicketResolutionDetails;
  waitingOn?: WaitingOn;
  pendingReason?: string;
  slaPauseReason?: string;
  managerReviewReason?: string;
  resolutionRejectedReason?: string;
}

export interface TicketResolutionDetails {
  diagnostic: string;
  rootCause: string;
  actionsTaken: string;
  nextRecommendation: string;
}

export interface TicketResolveRequest {
  resolutionSummary: string;
  resolutionDetails: TicketResolutionDetails;
}

export interface AgentWorkbench {
  availableToTake: Ticket[];
  assignedOpen: Ticket[];
  waitingCustomer: Ticket[];
  customerReplied: Ticket[];
  resolutionRejected: Ticket[];
}

export interface KnowledgeArticle extends BaseEntity {
  title: string;
  content: string;
  summary?: string;
  category?: string;
  tags?: string[];
  views?: number;
  helpfulCount?: number;
  notHelpfulCount?: number;
  isPublished?: boolean;
  authorName?: string;
  sourceTicketId?: number;
  sourceTicketReference?: string;
}

export interface KnowledgeArticleCreate {
  title?: string;
  content?: string;
  summary?: string;
  category?: string;
  tags?: string[];
  isPublished?: boolean;
  sourceTicketId?: number;
}

export interface KnowledgeArticleAssistRequest {
  title?: string;
  description?: string;
  category?: string;
}

// Comment interfaces
export interface Comment extends BaseEntity {
  content: string;
  isInternal?: boolean;
  author?: UserSummary;
  ticketId?: number;
  attachments?: Attachment[];
}

export interface CommentCreate {
  content: string;
  isInternal?: boolean;
}

// Attachment interfaces
export interface Attachment extends BaseEntity {
  fileName: string;
  originalName?: string;
  contentType?: string;
  fileType?: string;
  fileSize?: number;
  formattedFileSize?: string;
  downloadUrl?: string;
  ticketId?: number;
  uploadedBy?: UserSummary;
  uploadedAt?: string;
  alfrescoNodeId?: string;
}

export interface TicketArchiveDocument {
  id: string;
  label: string;
  kind: 'archive' | 'folder' | 'document' | 'attachment';
  synced: boolean;
  ref?: string | null;
  relativePath?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  attachmentId?: number | null;
}

export interface TicketHistoryEntry extends BaseEntity {
  action: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  description?: string;
  performedBy?: string;
  ticketId?: number;
  userId?: number;
}

export interface EscalationEvent {
  id: number;
  ticketId: number;
  ticketReference: string;
  fromLevel: number;
  toLevel: number;
  reason: string;
  triggeredBy: 'SYSTEM' | 'USER';
  fromAgentName?: string;
  toAgentName?: string;
  description?: string;
  slaPercentAtEscalation?: number;
  wasBlocked?: boolean;
  createdAt: string;
}

export interface WorkflowStatus {
  processInstanceId?: string;
  processDefinitionKey?: string;
  ticketReference?: string;
  ticketId?: string;
  currentActivity?: string;
  processStatus?: 'ACTIVE' | 'COMPLETED' | 'SUSPENDED' | 'NOT_FOUND' | 'ERROR' | string;
  startTime?: string;
  endTime?: string;
  complete?: boolean;
  lastErrorMessage?: string;
}

export interface WorkflowTraceStep {
  activityId?: string;
  activityName?: string;
  activityType?: string;
  startTime?: string;
  endTime?: string;
  finished?: boolean;
}

export interface WorkflowTrace {
  ticketReference?: string;
  processInstanceId?: string;
  processStatus?: string;
  currentActivity?: string;
  steps?: WorkflowTraceStep[];
}

export interface ArchivedTicketSearchParams extends PageRequest {
  clientId?: number;
  collaboratorId?: number;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  fromDate?: string;
  toDate?: string;
}

export interface MonthlyReport {
  year: number;
  month: number;
  periodLabel: string;
  generatedAt: string;
  resolvedTickets: number;
  averageResolutionTimeMinutes: number;
  formattedAverageResolutionTime: string;
  slaComplianceRate: number;
  topIncidentTypes: Record<string, number>;
  pdfReference: string;
  excelReference: string;
}

// Pagination interfaces
export interface PageRequest {
  page?: number;
  size?: number;
  sort?: string;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

// Dashboard interfaces
export interface DashboardStats {
  totalTickets: number;
  openTickets: number;
  resolvedTickets?: number;
  urgentTickets?: number;
  inProgressTickets?: number;
  closedTickets?: number;
  escalatedManualTickets?: number;
  escalatedSlaTickets?: number;
  resolvedToday?: number;
  ticketsCreatedToday?: number;
  ticketsResolvedToday?: number;
  avgResolutionTime?: number;
  formattedAverageResolutionTime?: string;
  averageSatisfactionRating?: number | null;
  slaBreachRate?: number;
  slaComplianceRate?: number;
  slaBreachedTickets?: number;
  slaAtRiskTickets?: number;
  slaOnTrackTickets?: number;
  ticketsByPriority?: Record<string, number>;
  ticketsByStatus?: Record<string, number>;
  dailyTrend?: TrendData[];
  ticketsTrend?: TrendData[];
  topAgents?: AgentPerformance[];
}

export interface TrendData {
  date: string;
  created: number;
  resolved: number;
}

export interface AgentPerformance {
  agentId: number;
  agentName?: string;
  avatarUrl?: string;
  totalTickets: number;
  resolvedTickets?: number;
  openTickets?: number;
  avgResolutionTime?: number;
  averageResolutionTime?: number;
  formattedAverageResolutionTime?: string;
  satisfactionScore?: number;
  averageSatisfactionRating?: number | null;
  slaComplianceRate?: number;
}

export interface AgentAvailability {
  agentId: number;
  agentName: string;
  status: 'AVAILABLE' | 'BUSY' | 'OFFLINE' | 'ON_BREAK' | 'AWAY' | string;
  statusSince?: string;
  statusReason?: string;
  maxConcurrentTickets?: number | null;
  currentTicketCount?: number | null;
  isInShift?: boolean | null;
}

// Notification interfaces
export interface Notification {
  id: number;
  type?: string;
  title?: string;
  message: string;
  ticketId?: number;
  ticketReference?: string;
  isRead?: boolean;
  read?: boolean;
  createdAt?: string;
  link?: string;
  icon?: string;

  // Smart SLA fields
  slaPercentage?: number;
  actionRequired?: boolean;
  suggestedActions?: string; // JSON array string
  recommendedAgent?: string;
  recommendedAgentId?: number;
}

export type SlaNotificationType = 'SLA_WARNING_50' | 'SLA_WARNING_80' | 'SLA_ESCALATION' | 'SLA_CRITICAL_EVENT' | 'SLA_WARNING' | 'SLA_BREACHED';

/** Parsed suggested actions from notification.suggestedActions JSON */
export function parseSuggestedActions(notification: Notification): string[] {
  if (!notification.suggestedActions) return [];
  try {
    return JSON.parse(notification.suggestedActions);
  } catch {
    return [];
  }
}

/** Returns true when the notification is SLA-related */
export function isSlaNotification(notification: Notification): boolean {
  return !!notification.type && notification.type.startsWith('SLA_');
}
