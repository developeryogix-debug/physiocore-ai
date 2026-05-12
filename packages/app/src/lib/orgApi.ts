/**
 * orgApi.ts — Multi-tenant organisation data layer
 * All Supabase queries for organisations, members, patients, invites.
 */
import { supabase } from '@physiocore/supabase';

// Use any to bypass strict generated types for new tables
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Organisation {
  id: string;
  name: string;
  type: 'clinic' | 'gym' | 'yoga_studio' | 'wellness_retreat';
  slug: string;
  logo_url: string | null;
  contact_email: string | null;
  country: string;
  created_by: string;
  created_at: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: 'org_admin' | 'clinician' | 'trainer' | 'patient';
  joined_at: string;
  profile?: { full_name: string; email: string };
}

export interface ClinicianPatient {
  id: string;
  clinician_id: string;
  patient_id: string;
  org_id: string | null;
  assigned_at: string;
  status: string;
  profile?: {
    full_name: string;
    email: string;
    conditions?: string;
    goals?: string;
  };
}

export interface Invite {
  id: string;
  org_id: string;
  invited_by: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface PlatformStats {
  totalOrgs: number;
  totalUsers: number;
  totalSessionsToday: number;
}

// ── Organisations ─────────────────────────────────────────────────────────────

export async function getAllOrgs(): Promise<Organisation[]> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const { data } = await db.from('organisations').select('*').order('created_at', { ascending: false });
  return (data ?? []) as Organisation[];
}

export async function createOrg(org: {
  name: string; type: string; slug: string; contact_email: string; created_by: string;
}): Promise<Organisation | null> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const { data } = await db.from('organisations').insert(org).select().single();
  return data as Organisation | null;
}

export async function getMyOrg(userId: string): Promise<Organisation | null> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const { data: member } = await db.from('org_members').select('org_id').eq('user_id', userId).maybeSingle() as { data: { org_id: string } | null };
  if (!member) return null;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const { data } = await db.from('organisations').select('*').eq('id', member.org_id).maybeSingle();
  return data as Organisation | null;
}

export async function updateOrg(
  id: string,
  updates: Partial<Pick<Organisation, 'name' | 'contact_email' | 'logo_url'>>,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  await db.from('organisations').update(updates).eq('id', id);
}

// ── Members ───────────────────────────────────────────────────────────────────

export async function getOrgMembers(orgId: string): Promise<OrgMember[]> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const { data } = await db.from('org_members').select('*').eq('org_id', orgId).order('joined_at');
  return (data ?? []) as OrgMember[];
}

// ── Clinician → Patient links ─────────────────────────────────────────────────

export async function getClinicianPatients(clinicianId: string): Promise<ClinicianPatient[]> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const { data } = await db
    .from('clinician_patients')
    .select('*')
    .eq('clinician_id', clinicianId)
    .eq('status', 'active')
    .order('assigned_at', { ascending: false });
  return (data ?? []) as ClinicianPatient[];
}

export async function getOrgPatients(orgId: string): Promise<ClinicianPatient[]> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const { data } = await db
    .from('clinician_patients')
    .select('*')
    .eq('org_id', orgId)
    .order('assigned_at', { ascending: false });
  return (data ?? []) as ClinicianPatient[];
}

// ── Invites ───────────────────────────────────────────────────────────────────

export async function createInvite(invite: {
  org_id: string; invited_by: string; email: string; role: string;
}): Promise<Invite | null> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const { data } = await db.from('invites').insert(invite).select().single();
  return data as Invite | null;
}

export async function getInviteByToken(token: string): Promise<Invite | null> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const { data } = await db.from('invites').select('*').eq('token', token).maybeSingle();
  return data as Invite | null;
}

export async function acceptInvite(
  token: string,
  userId: string,
): Promise<{ role: string; orgId: string } | null> {
  const invite = await getInviteByToken(token);
  if (!invite || invite.used_at || new Date(invite.expires_at) < new Date()) return null;

  await Promise.all([
    // Mark invite used
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    db.from('invites').update({ used_at: new Date().toISOString() }).eq('token', token),
    // Create org membership
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    db.from('org_members').upsert({ org_id: invite.org_id, user_id: userId, role: invite.role, invited_by: invite.invited_by }),
    // Update profile with org_id and role
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    db.from('profiles').upsert({ user_id: userId, org_id: invite.org_id, role: invite.role }),
  ]);

  // If patient invite, create clinician→patient link
  if (invite.role === 'patient' && invite.invited_by) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await db.from('clinician_patients').upsert({
      clinician_id: invite.invited_by,
      patient_id: userId,
      org_id: invite.org_id,
    });
  }

  return { role: invite.role, orgId: invite.org_id };
}

// ── Admin queries ─────────────────────────────────────────────────────────────

export interface AdminUser {
  user_id: string; full_name: string; role: string; org_id: string | null; created_at?: string;
}

export async function getAllUsers(): Promise<AdminUser[]> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const { data } = await db.from('profiles').select('user_id, full_name, role, org_id, created_at').order('created_at', { ascending: false });
  return (data ?? []) as AdminUser[];
}

export async function updateUserRole(userId: string, role: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  await db.from('profiles').update({ role }).eq('user_id', userId);
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [orgsRes, usersRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    db.from('organisations').select('id', { count: 'exact', head: true }) as Promise<{ count: number | null }>,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    db.from('profiles').select('user_id', { count: 'exact', head: true }) as Promise<{ count: number | null }>,
  ]);
  return {
    totalOrgs: orgsRes.count ?? 0,
    totalUsers: usersRes.count ?? 0,
    totalSessionsToday: 0, // Would need sessions table with date filter
  };
}
