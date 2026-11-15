import React, { useState, useMemo } from 'react';
import {
  hanujaiOpenApiSpec,
  type OpenApiOperation,
  type OpenApiPathItem,
} from '../../data/api/openapiSpec';
import {
  Search,
  Download,
  Lock,
  ChevronDown,
  ChevronRight,
  Play,
  CheckCircle,
  Copy,
} from 'lucide-react';

interface EndpointEntry {
  path: string;
  method: 'get' | 'post' | 'put' | 'delete' | 'patch';
  operation: OpenApiOperation;
}

export const SwaggerPortal: React.FC = () => {
  const [selectedEnv, setSelectedEnv] = useState<string>(
    hanujaiOpenApiSpec.servers[0].url
  );
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedEndpoints, setExpandedEndpoints] = useState<Set<string>>(
    new Set(['/api/documents/parent-verify:get', '/api/attendance/sessions:post'])
  );

  // Try-It-Out State
  const [activeTestKey, setActiveTestKey] = useState<string | null>(null);
  const [testHeaders, setTestHeaders] = useState<string>('{\n  "Authorization": "Bearer mock-staff-token"\n}');
  const [testBody, setTestBody] = useState<string>('{\n  "classId": "class-10-a",\n  "date": "2026-11-16"\n}');
  const [testResponse, setTestResponse] = useState<{
    status: number;
    statusText: string;
    timeMs: number;
    data: unknown;
  } | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Flatten endpoints into list
  const allEndpoints = useMemo<EndpointEntry[]>(() => {
    const list: EndpointEntry[] = [];
    Object.entries(hanujaiOpenApiSpec.paths).forEach(([path, pathItem]) => {
      (['get', 'post', 'put', 'delete', 'patch'] as const).forEach(method => {
        const op = pathItem[method as keyof OpenApiPathItem];
        if (op) {
          list.push({ path, method, operation: op });
        }
      });
    });
    return list;
  }, []);

  const tags = useMemo(() => {
    return ['All', ...hanujaiOpenApiSpec.tags.map(t => t.name)];
  }, []);

  const filteredEndpoints = useMemo(() => {
    return allEndpoints.filter(ep => {
      const matchesTag =
        selectedTag === 'All' || ep.operation.tags.includes(selectedTag);
      const matchesSearch =
        !searchQuery.trim() ||
        ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ep.operation.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ep.operation.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTag && matchesSearch;
    });
  }, [allEndpoints, selectedTag, searchQuery]);

  const toggleEndpoint = (key: string) => {
    setExpandedEndpoints(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleDownloadSpec = () => {
    const jsonStr = JSON.stringify(hanujaiOpenApiSpec, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hanujai-erp-openapi-v${hanujaiOpenApiSpec.info.version}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const executeMockRequest = async (ep: EndpointEntry) => {
    setIsExecuting(true);
    setTestResponse(null);
    const start = performance.now();

    await new Promise(r => setTimeout(r, 120));
    const duration = Math.round(performance.now() - start);

    let status = 200;
    let statusText = 'OK';
    let data: unknown = { message: 'Mock execution completed successfully.' };

    if (ep.path === '/api/documents/parent-verify') {
      status = 200;
      statusText = 'OK';
      data = {
        valid: true,
        invitationId: 'inv-a9f8b1c2',
        studentId: 'stu-10a-01',
        studentName: 'Aarav Sharma',
        admissionNumber: 'HHS-2024-001',
        className: 'Class 10-A',
        requestedSlots: ['aadhaar_card', 'birth_certificate', 'transfer_certificate'],
        uploadSessionToken: 'mock.hmac_session_token.c8f9b2',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };
    } else if (ep.path === '/api/developer/health') {
      status = 200;
      statusText = 'OK';
      data = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptimeSeconds: 86400,
        services: {
          firestore: 'operational',
          vercelBlob: 'operational',
          auth: 'operational',
          whatsAppWorker: 'standby',
        },
      };
    } else if (ep.path === '/api/attendance/sessions' && ep.method === 'post') {
      status = 200;
      statusText = 'OK';
      data = {
        success: true,
        message: 'Attendance locked for Class 10-A. 34 notification jobs enqueued.',
      };
    } else {
      const respCodes = Object.keys(ep.operation.responses);
      const primaryCode = parseInt(respCodes[0] || '200', 10);
      status = isNaN(primaryCode) ? 200 : primaryCode;
      statusText = status === 201 ? 'Created' : 'OK';
      data = {
        endpoint: `${selectedEnv}${ep.path}`,
        method: ep.method.toUpperCase(),
        status,
        timestamp: new Date().toISOString(),
        simulation: true,
      };
    }

    setTestResponse({
      status,
      statusText,
      timeMs: duration,
      data,
    });
    setIsExecuting(false);
  };

  const getMethodColor = (m: string) => {
    switch (m) {
      case 'get':
        return { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' };
      case 'post':
        return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' };
      case 'put':
        return { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' };
      case 'delete':
        return { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' };
      default:
        return { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div
        className="hhs-card"
        style={{
          padding: '24px',
          background: 'linear-gradient(135deg, #0A1931 0%, #1E293B 100%)',
          color: '#FFFFFF',
          borderRadius: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: '#FFFFFF' }}>
                {hanujaiOpenApiSpec.info.title}
              </h2>
              <span
                style={{
                  fontSize: '0.75rem',
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontWeight: 600,
                }}
              >
                OAS {hanujaiOpenApiSpec.openapi}
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  backgroundColor: '#10B981',
                  color: '#FFFFFF',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontWeight: 600,
                }}
              >
                v{hanujaiOpenApiSpec.info.version}
              </span>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '0.9rem', color: '#CBD5E1', maxWidth: '750px', lineHeight: 1.5 }}>
              {hanujaiOpenApiSpec.info.description}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={handleDownloadSpec}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 16px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#FFFFFF',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Download size={16} />
              Export OpenAPI 3.0 (JSON)
            </button>
          </div>
        </div>

        {/* Server & Environment Selector */}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.15)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#94A3B8' }}>Active Environment:</span>
          <select
            value={selectedEnv}
            onChange={e => setSelectedEnv(e.target.value)}
            style={{
              backgroundColor: '#0F172A',
              color: '#F8FAFC',
              border: '1px solid #334155',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 500,
              minWidth: '320px',
            }}
          >
            {hanujaiOpenApiSpec.servers.map(s => (
              <option key={s.url} value={s.url}>
                {s.url} — {s.description}
              </option>
            ))}
          </select>
          <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
            Protected Sandbox Mode: Try It Out runs in safe simulation mode with realistic response mocks to protect production database integrity.
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="hhs-card"
        style={{
          padding: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 300px' }}>
          <Search size={18} style={{ color: '#64748B' }} />
          <input
            type="text"
            placeholder="Search API endpoints by path, description, or keyword..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              fontSize: '0.9rem',
              background: 'transparent',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', maxWidth: '100%' }}>
          {tags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: selectedTag === tag ? 700 : 500,
                backgroundColor: selectedTag === tag ? '#0A1931' : '#F1F5F9',
                color: selectedTag === tag ? '#FFFFFF' : '#475569',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Endpoints List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredEndpoints.length === 0 ? (
          <div className="hhs-card" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
            No endpoints match the selected filters or search criteria.
          </div>
        ) : (
          filteredEndpoints.map(ep => {
            const key = `${ep.path}:${ep.method}`;
            const isExpanded = expandedEndpoints.has(key);
            const mColors = getMethodColor(ep.method);
            const isTesting = activeTestKey === key;

            return (
              <div
                key={key}
                className="hhs-card"
                style={{
                  border: `1px solid ${isExpanded ? mColors.border : '#E2E8F0'}`,
                  borderRadius: '10px',
                  overflow: 'hidden',
                  transition: 'border-color 0.2s ease',
                }}
              >
                {/* Collapsible Header */}
                <div
                  onClick={() => toggleEndpoint(key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 18px',
                    cursor: 'pointer',
                    backgroundColor: isExpanded ? mColors.bg : '#FFFFFF',
                    borderBottom: isExpanded ? `1px solid ${mColors.border}` : 'none',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '1 1 auto', minWidth: 0 }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontWeight: 800,
                        fontSize: '0.82rem',
                        textTransform: 'uppercase',
                        backgroundColor: mColors.bg,
                        color: mColors.text,
                        border: `1px solid ${mColors.border}`,
                        minWidth: '65px',
                        textAlign: 'center',
                      }}
                    >
                      {ep.method}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.92rem', color: '#0F172A' }}>
                      {ep.path}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      — {ep.operation.summary}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {ep.operation.security && ep.operation.security.length > 0 && (
                      <span
                        title="Authorized Endpoint"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.75rem',
                          color: '#475569',
                          backgroundColor: '#F8FAFC',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          border: '1px solid #E2E8F0',
                        }}
                      >
                        <Lock size={12} />
                        Auth
                      </span>
                    )}
                    {isExpanded ? <ChevronDown size={18} color="#64748B" /> : <ChevronRight size={18} color="#64748B" />}
                  </div>
                </div>

                {/* Expanded Endpoint Body */}
                {isExpanded && (
                  <div style={{ padding: '20px', backgroundColor: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Description */}
                    <div>
                      <h4 style={{ margin: '0 0 6px', fontSize: '0.88rem', fontWeight: 700, color: '#334155' }}>
                        Description
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
                        {ep.operation.description}
                      </p>
                    </div>

                    {/* Parameters Table */}
                    {ep.operation.parameters && ep.operation.parameters.length > 0 && (
                      <div>
                        <h4 style={{ margin: '0 0 10px', fontSize: '0.88rem', fontWeight: 700, color: '#334155' }}>
                          Parameters ({ep.operation.parameters.length})
                        </h4>
                        <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead style={{ backgroundColor: '#F8FAFC', textAlign: 'left' }}>
                              <tr>
                                <th style={{ padding: '8px 12px', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>Name</th>
                                <th style={{ padding: '8px 12px', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>In</th>
                                <th style={{ padding: '8px 12px', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>Type</th>
                                <th style={{ padding: '8px 12px', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>Required</th>
                                <th style={{ padding: '8px 12px', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>Description</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ep.operation.parameters.map(p => (
                                <tr key={p.name} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                  <td style={{ padding: '8px 12px', fontWeight: 600, fontFamily: 'monospace' }}>{p.name}</td>
                                  <td style={{ padding: '8px 12px', color: '#64748B' }}>{p.in}</td>
                                  <td style={{ padding: '8px 12px', color: '#0369A1' }}>{p.schema.type}</td>
                                  <td style={{ padding: '8px 12px' }}>
                                    {p.required ? (
                                      <span style={{ color: '#DC2626', fontWeight: 700 }}>Required</span>
                                    ) : (
                                      <span style={{ color: '#64748B' }}>Optional</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '8px 12px', color: '#475569' }}>{p.description}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Request Body Specification */}
                    {ep.operation.requestBody && (
                      <div>
                        <h4 style={{ margin: '0 0 8px', fontSize: '0.88rem', fontWeight: 700, color: '#334155' }}>
                          Request Body ({Object.keys(ep.operation.requestBody.content).join(', ')})
                        </h4>
                        <div
                          style={{
                            padding: '12px',
                            backgroundColor: '#F8FAFC',
                            borderRadius: '8px',
                            border: '1px solid #E2E8F0',
                            fontFamily: 'monospace',
                            fontSize: '0.8rem',
                            color: '#1E293B',
                            maxHeight: '180px',
                            overflowY: 'auto',
                          }}
                        >
                          <pre style={{ margin: 0 }}>
                            {JSON.stringify(ep.operation.requestBody.content, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Responses Table */}
                    <div>
                      <h4 style={{ margin: '0 0 10px', fontSize: '0.88rem', fontWeight: 700, color: '#334155' }}>
                        Responses
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {Object.entries(ep.operation.responses).map(([code, resp]) => {
                          const isSuccess = code.startsWith('2');
                          return (
                            <div
                              key={code}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '8px 12px',
                                borderRadius: '6px',
                                backgroundColor: isSuccess ? '#F0FDF4' : '#FEF2F2',
                                border: `1px solid ${isSuccess ? '#BBF7D0' : '#FECACA'}`,
                                fontSize: '0.82rem',
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: 800,
                                  fontFamily: 'monospace',
                                  color: isSuccess ? '#15803D' : '#B91C1C',
                                  minWidth: '40px',
                                }}
                              >
                                {code}
                              </span>
                              <span style={{ color: '#334155', fontWeight: 500 }}>
                                {resp.description}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Interactive "Try It Out" Console */}
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '16px',
                        backgroundColor: '#F8FAFC',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Play size={16} color="#0A1931" />
                          <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#0A1931' }}>
                            Interactive API Explorer
                          </h4>
                        </div>
                        <button
                          onClick={() => {
                            if (isTesting) setActiveTestKey(null);
                            else {
                              setActiveTestKey(key);
                              setTestResponse(null);
                            }
                          }}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: isTesting ? '#475569' : '#0A1931',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {isTesting ? 'Close Explorer' : 'Try this endpoint'}
                        </button>
                      </div>

                      {isTesting && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                              Request Headers (JSON)
                            </label>
                            <textarea
                              value={testHeaders}
                              onChange={e => setTestHeaders(e.target.value)}
                              rows={2}
                              style={{
                                width: '100%',
                                fontFamily: 'monospace',
                                fontSize: '0.8rem',
                                padding: '8px',
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                              }}
                            />
                          </div>

                          {ep.method !== 'get' && (
                            <div>
                              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                                Request Body (JSON)
                              </label>
                              <textarea
                                value={testBody}
                                onChange={e => setTestBody(e.target.value)}
                                rows={3}
                                style={{
                                  width: '100%',
                                  fontFamily: 'monospace',
                                  fontSize: '0.8rem',
                                  padding: '8px',
                                  borderRadius: '6px',
                                  border: '1px solid #CBD5E1',
                                }}
                              />
                            </div>
                          )}

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <button
                              disabled={isExecuting}
                              onClick={() => executeMockRequest(ep)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 16px',
                                backgroundColor: isExecuting ? '#94A3B8' : '#2563EB',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                cursor: isExecuting ? 'not-allowed' : 'pointer',
                              }}
                            >
                              <Play size={14} />
                              {isExecuting ? 'Executing...' : 'Execute Request'}
                            </button>
                            <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                              Target: {selectedEnv}{ep.path}
                            </span>
                          </div>

                          {testResponse && (
                            <div
                              style={{
                                marginTop: '10px',
                                padding: '12px',
                                backgroundColor: '#0F172A',
                                borderRadius: '6px',
                                color: '#F8FAFC',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '8px', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span
                                    style={{
                                      fontWeight: 800,
                                      fontSize: '0.85rem',
                                      color: testResponse.status < 400 ? '#4ADE80' : '#F87171',
                                    }}
                                  >
                                    Status: {testResponse.status} {testResponse.statusText}
                                  </span>
                                  <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                                    Duration: {testResponse.timeMs}ms
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleCopy(JSON.stringify(testResponse.data, null, 2), key)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    color: '#94A3B8',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {copiedKey === key ? <CheckCircle size={12} color="#4ADE80" /> : <Copy size={12} />}
                                  {copiedKey === key ? 'Copied' : 'Copy Response'}
                                </button>
                              </div>
                              <pre style={{ margin: 0, fontSize: '0.78rem', fontFamily: 'monospace', maxHeight: '200px', overflowY: 'auto' }}>
                                {JSON.stringify(testResponse.data, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
