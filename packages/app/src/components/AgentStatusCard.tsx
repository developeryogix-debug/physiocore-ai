import type { ReactNode } from 'react';
import type { AgentResult } from '@physiocore/types';

interface Props<T> {
  title: string;
  result: AgentResult<T> | undefined;
  isLoading: boolean;
  renderData: (data: T) => ReactNode;
}

const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-sm)',
  padding: '20px 24px',
  border: '1px solid #e2e8f0',
};

const titleStyle: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 600,
  marginBottom: '16px',
  color: 'var(--color-text)',
};

const metaStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--color-text-muted)',
  marginTop: '12px',
  paddingTop: '12px',
  borderTop: '1px solid #f1f5f9',
};

const errorStyle: React.CSSProperties = {
  color: 'var(--color-danger)',
  fontSize: '0.875rem',
  padding: '12px',
  background: '#fef2f2',
  borderRadius: 'var(--radius-md)',
};

const spinnerContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '12px',
  padding: '24px 0',
  color: 'var(--color-text-muted)',
  fontSize: '0.875rem',
};

export function AgentStatusCard<T>({
  title,
  result,
  isLoading,
  renderData,
}: Props<T>) {
  return (
    <div style={cardStyle}>
      <div style={titleStyle}>{title}</div>

      {isLoading && (
        <div style={spinnerContainerStyle}>
          <Spinner />
          <span>Agent processing...</span>
        </div>
      )}

      {!isLoading && !result && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          No data yet. Run the agent to see results.
        </p>
      )}

      {!isLoading && result && !result.success && (
        <div style={errorStyle}>
          <strong>Error {result.error?.code}:</strong> {result.error?.message}
          {result.error?.retryable && (
            <span style={{ marginLeft: '8px', fontStyle: 'italic' }}>(retryable)</span>
          )}
        </div>
      )}

      {!isLoading && result?.success && result.data !== undefined && (
        <>
          {renderData(result.data as T)}
          <div style={metaStyle}>
            Agent: {result.metadata.agentId} v{result.metadata.agentVersion}
            {' · '}
            {result.metadata.processingMs}ms
            {result.metadata.tokensUsed !== undefined && (
              <> · {result.metadata.tokensUsed} tokens</>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-primary)"
      strokeWidth="2.5"
      strokeLinecap="round"
      style={{ animation: 'spin 0.8s linear infinite' }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" stroke="#e2e8f0" />
      <path d="M12 2 A10 10 0 0 1 22 12" />
    </svg>
  );
}
