import { supabase } from '@physiocore/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface SessionSummary {
  date: string;
  exercise: string;
  reps: number;
  avg_score: number;
  top_deviation: string;
  ai_feedback_summary: string;
  pain_before?: number;
  pain_after?: number;
}

export async function saveSessionSummary(summary: SessionSummary): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await db.from('session_summaries').insert({ user_id: userId, ...summary });
  } catch { /* non-fatal */ }
}

export async function getRecentSessionSummaries(limit = 5): Promise<SessionSummary[]> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return [];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    const { data } = await db
      .from('session_summaries')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(limit);
    return (data as SessionSummary[]) ?? [];
  } catch {
    return [];
  }
}

export function formatSessionsForPrompt(sessions: SessionSummary[]): string {
  if (sessions.length === 0) return '';
  const lines = sessions.map(s => {
    const date = new Date(s.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    return `- ${date}: ${s.exercise.replace(/_/g, ' ')}, ${s.reps} reps, ${s.avg_score}/100${s.top_deviation ? `, issue: ${s.top_deviation}` : ''}${s.pain_before !== undefined ? `, pain: ${s.pain_before}/10` : ''}`;
  });
  return `User's recent sessions:\n${lines.join('\n')}`;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  page?: string;
}

export async function saveChatMessage(msg: ChatMessage): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await db.from('chat_messages').insert({
      user_id: userId,
      role: msg.role,
      content: msg.content,
      page: msg.page ?? 'unknown',
      created_at: new Date().toISOString(),
    });
  } catch { /* non-fatal */ }
}

export async function loadChatHistory(page: string, limit = 10): Promise<ChatMessage[]> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return [];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    const { data } = await db
      .from('chat_messages')
      .select('role, content')
      .eq('user_id', userId)
      .eq('page', page)
      .order('created_at', { ascending: false })
      .limit(limit);
    return ((data as ChatMessage[]) ?? []).reverse();
  } catch {
    return [];
  }
}
