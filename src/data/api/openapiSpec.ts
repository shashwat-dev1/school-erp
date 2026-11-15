/**
 * HanuJai High School ERP — OpenAPI 3.0.3 Specification
 * 
 * Formal API specification for institutional operations:
 * - Authentication & Role Administration
 * - Student Management & Data Ingestion
 * - Daily Attendance & Correction Requests
 * - Private Document Storage & Management
 * - Parent Document Collection (Zero-OTP Cryptographic Tokens)
 * - WhatsApp Notification Pipeline
 * - Developer & Infrastructure Diagnostics
 */

export interface OpenApiParameter {
  name: string;
  in: 'path' | 'query' | 'header';
  required?: boolean;
  description: string;
  schema: {
    type: string;
    format?: string;
    enum?: string[];
    default?: unknown;
    example?: unknown;
  };
}

export interface OpenApiRequestBody {
  description?: string;
  required?: boolean;
  content: {
    'application/json'?: {
      schema: Record<string, unknown>;
      example?: Record<string, unknown>;
    };
    'multipart/form-data'?: {
      schema: Record<string, unknown>;
    };
  };
}

export interface OpenApiResponse {
  description: string;
  content?: {
    'application/json'?: {
      schema: Record<string, unknown>;
      example?: Record<string, unknown>;
    };
  };
}

export interface OpenApiOperation {
  tags: string[];
  summary: string;
  description: string;
  operationId: string;
  security?: Array<Record<string, string[]>>;
  parameters?: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  responses: Record<string, OpenApiResponse>;
}

export interface OpenApiPathItem {
  get?: OpenApiOperation;
  post?: OpenApiOperation;
  put?: OpenApiOperation;
  delete?: OpenApiOperation;
  patch?: OpenApiOperation;
}

export interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
    contact: {
      name: string;
      email: string;
    };
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  tags: Array<{
    name: string;
    description: string;
  }>;
  paths: Record<string, OpenApiPathItem>;
  components: {
    securitySchemes: Record<string, unknown>;
    schemas: Record<string, unknown>;
  };
}

export const hanujaiOpenApiSpec: OpenApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'HanuJai High School ERP Institutional API',
    version: '1.0.0',
    description:
      'Production-grade RESTful API specification for HanuJai High School ERP (Jaipur, Rajasthan, India). Covers staff identity, student lifecycle, daily attendance registers, principal-approved corrections, encrypted document storage, zero-OTP parent uploads, and WhatsApp operations.',
    contact: {
      name: 'HanuJai Systems Administration',
      email: 'developer@hanujai.edu.in',
    },
  },
  servers: [
    {
      url: 'https://hanujai-erp.vercel.app',
      description: 'Production Cloud Environment (Vercel Edge & Serverless)',
    },
    {
      url: 'https://hanujai-staging.vercel.app',
      description: 'Staging Sandbox Environment',
    },
    {
      url: 'http://localhost:5173',
      description: 'Local Developer Workstation',
    },
  ],
  tags: [
    { name: 'Serverless Document APIs', description: 'Live Vercel Edge & Serverless endpoints deployed under /api/documents/' },
    { name: 'Authentication', description: 'Staff credential authentication, token lifecycle & developer persona preview' },
    { name: 'Students', description: 'Student directory, profile lookup, enrollment, and bulk Excel ingestion' },
    { name: 'Attendance', description: 'Daily attendance register submission and institutional compliance reports' },
    { name: 'Corrections', description: 'Audited attendance correction request and principal approval workflow' },
    { name: 'WhatsApp Notifications', description: 'Automated attendance notifications and document reminder messaging' },
    { name: 'Developer & Diagnostics', description: 'System health monitoring, database schema introspection & backups' },
  ],
  components: {
    securitySchemes: {
      StaffBearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Firebase Authentication ID Token issued to active HanuJai staff user.',
      },
      ParentTokenAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-parent-token',
        description: '256-bit cryptographically random token received via WhatsApp invitation link.',
      },
      ParentSessionAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-parent-session-token',
        description: 'HMAC-SHA256 scoped upload session token issued after initial token verification.',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string', description: 'Human-readable error description.' },
          code: { type: 'string', description: 'Standardized error code.' },
        },
        required: ['error'],
      },
      StudentRecord: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'stu-10a-01' },
          admissionNumber: { type: 'string', example: 'HHS-2024-001' },
          rollNumber: { type: 'integer', example: 1 },
          fullName: { type: 'string', example: 'Aarav Sharma' },
          gender: { type: 'string', enum: ['M', 'F', 'O'], example: 'M' },
          classId: { type: 'string', example: 'class-10-a' },
          guardianName: { type: 'string', example: 'Rajesh Sharma' },
          guardianRelation: { type: 'string', example: 'Father' },
          primaryPhone: { type: 'string', example: '+91 98290 12345' },
          status: { type: 'string', enum: ['active', 'inactive', 'transferred', 'graduated'], example: 'active' },
        },
      },
      AttendanceSession: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'att-class-10-a-2026-11-16' },
          date: { type: 'string', format: 'date', example: '2026-11-16' },
          classId: { type: 'string', example: 'class-10-a' },
          status: { type: 'string', enum: ['submitted', 'locked'], example: 'submitted' },
          submittedBy: { type: 'string', example: 'staff-admin' },
          submittedAt: { type: 'string', format: 'date-time' },
          records: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                studentId: { type: 'string', example: 'stu-10a-01' },
                status: { type: 'string', enum: ['present', 'absent', 'late', 'half_day'], example: 'present' },
                remarks: { type: 'string', example: '' },
              },
            },
          },
        },
      },
      AttendanceCorrection: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'corr-001' },
          sessionId: { type: 'string', example: 'att-class-10-a-2026-11-16' },
          studentId: { type: 'string', example: 'stu-10a-01' },
          classId: { type: 'string', example: 'class-10-a' },
          date: { type: 'string', example: '2026-11-16' },
          currentStatus: { type: 'string', example: 'absent' },
          proposedStatus: { type: 'string', example: 'present' },
          reason: { type: 'string', example: 'Medical leave certificate submitted.' },
          requestedBy: { type: 'string', example: 'staff-admin' },
          status: { type: 'string', enum: ['pending', 'approved', 'rejected'], example: 'pending' },
          reviewedBy: { type: 'string', nullable: true },
          reviewedAt: { type: 'string', nullable: true },
        },
      },
      ParentVerificationResponse: {
        type: 'object',
        properties: {
          valid: { type: 'boolean', example: true },
          invitationId: { type: 'string', example: 'inv-a9f8b1c2' },
          studentId: { type: 'string', example: 'stu-10a-01' },
          studentName: { type: 'string', example: 'Aarav Sharma' },
          admissionNumber: { type: 'string', example: 'HHS-2024-001' },
          className: { type: 'string', example: 'Class 10-A' },
          requestedSlots: {
            type: 'array',
            items: { type: 'string' },
            example: ['aadhaar_card', 'birth_certificate', 'transfer_certificate'],
          },
          uploadSessionToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          expiresAt: { type: 'string', format: 'date-time' },
        },
      },
      SystemHealthReport: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'], example: 'healthy' },
          timestamp: { type: 'string', format: 'date-time' },
          uptimeSeconds: { type: 'integer', example: 86400 },
          services: {
            type: 'object',
            properties: {
              firestore: { type: 'string', example: 'operational' },
              vercelBlob: { type: 'string', example: 'operational' },
              auth: { type: 'string', example: 'operational' },
              whatsAppWorker: { type: 'string', example: 'standby' },
            },
          },
        },
      },
    },
  },
  paths: {
    '/api/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Staff authentication login',
        description: 'Authenticates a staff member using institutional email and password, returning their active profile, role, and authorized permissions.',
        operationId: 'staffLogin',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email', example: 'admin@hanujai.edu.in' },
                  password: { type: 'string', format: 'password', example: '••••••••' },
                },
                required: ['email', 'password'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Authentication successful with staff role details.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', example: 'staff-admin' },
                        email: { type: 'string', example: 'admin@hanujai.edu.in' },
                        name: { type: 'string', example: 'Admin Office' },
                        role: { type: 'string', enum: ['developer', 'admin', 'principal'], example: 'admin' },
                        status: { type: 'string', example: 'active' },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { description: 'Invalid credentials or inactive account.' },
        },
      },
    },
    '/api/students': {
      get: {
        tags: ['Students'],
        summary: 'List students with filtering',
        description: 'Returns a list of students enrolled in HanuJai High School. Filter by class, search string, or attendance threshold.',
        operationId: 'getStudents',
        security: [{ StaffBearerAuth: [] }],
        parameters: [
          {
            name: 'classId',
            in: 'query',
            description: 'Filter students by class ID (e.g., class-10-a).',
            schema: { type: 'string', example: 'class-10-a' },
          },
          {
            name: 'search',
            in: 'query',
            description: 'Search string matching student name, roll number, or admission ID.',
            schema: { type: 'string' },
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Maximum number of student records to return.',
            schema: { type: 'integer', default: 50 },
          },
        ],
        responses: {
          '200': {
            description: 'List of student records successfully retrieved.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    items: { type: 'array', items: { $ref: '#/components/schemas/StudentRecord' } },
                    total: { type: 'integer', example: 450 },
                  },
                },
              },
            },
          },
          '401': { description: 'Missing or expired staff authorization token.' },
        },
      },
      post: {
        tags: ['Students'],
        summary: 'Enroll new student',
        description: 'Creates a new student record in the institutional directory. Authorized for Developer and Admin Office roles only.',
        operationId: 'createStudent',
        security: [{ StaffBearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StudentRecord' },
            },
          },
        },
        responses: {
          '201': { description: 'Student enrolled successfully.' },
          '400': { description: 'Validation failed or duplicate admission number.' },
          '403': { description: 'Insufficient permissions (Principal has read-only access).' },
        },
      },
    },
    '/api/students/import': {
      post: {
        tags: ['Students'],
        summary: 'Bulk Excel student data import',
        description: 'Ingests student records from a 7-column Excel (.xlsx) file. Supports preview validation, duplicate detection, and batch insertion.',
        operationId: 'importStudentsExcel',
        security: [{ StaffBearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  rows: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        admissionNumber: { type: 'string' },
                        rollNumber: { type: 'integer' },
                        fullName: { type: 'string' },
                        gender: { type: 'string' },
                        classId: { type: 'string' },
                        guardianName: { type: 'string' },
                        primaryPhone: { type: 'string' },
                      },
                    },
                  },
                  mode: { type: 'string', enum: ['preview', 'execute'], default: 'preview' },
                },
                required: ['rows'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Import preview or execution summary.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    totalRows: { type: 'integer', example: 35 },
                    validRows: { type: 'integer', example: 34 },
                    invalidRows: { type: 'integer', example: 1 },
                    duplicates: { type: 'integer', example: 0 },
                    created: { type: 'integer', example: 34 },
                  },
                },
              },
            },
          },
          '403': { description: 'Principal role is restricted to read-only access.' },
        },
      },
    },
    '/api/attendance/sessions': {
      get: {
        tags: ['Attendance'],
        summary: 'Query attendance sessions',
        description: 'Retrieves attendance sessions for a specific academic class and date.',
        operationId: 'getAttendanceSessions',
        security: [{ StaffBearerAuth: [] }],
        parameters: [
          { name: 'date', in: 'query', required: true, description: 'Date in YYYY-MM-DD format', schema: { type: 'string', format: 'date' } },
          { name: 'classId', in: 'query', required: true, description: 'Class identifier', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Attendance session data.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AttendanceSession' },
              },
            },
          },
        },
      },
      post: {
        tags: ['Attendance'],
        summary: 'Submit daily class attendance register',
        description: 'Records attendance for all students in a class. Locks the register after initial submission and queues WhatsApp parent notification jobs.',
        operationId: 'submitAttendance',
        security: [{ StaffBearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AttendanceSession' },
            },
          },
        },
        responses: {
          '200': { description: 'Attendance register submitted and parent notifications queued.' },
          '400': { description: 'Incomplete student attendance records.' },
          '403': { description: 'Principal role is restricted to read-only oversight.' },
          '409': { description: 'Attendance already submitted for this class and date.' },
        },
      },
    },
    '/api/attendance/corrections': {
      get: {
        tags: ['Corrections'],
        summary: 'List attendance correction requests',
        description: 'Returns attendance correction requests with optional status filtering (pending, approved, rejected).',
        operationId: 'getCorrections',
        security: [{ StaffBearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'approved', 'rejected'] }, description: 'Filter by request review state' },
        ],
        responses: {
          '200': {
            description: 'List of correction requests.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/AttendanceCorrection' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Corrections'],
        summary: 'Request attendance correction',
        description: 'Admin Office submits an auditable correction request for a locked attendance register with mandatory justification.',
        operationId: 'createCorrectionRequest',
        security: [{ StaffBearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  sessionId: { type: 'string' },
                  studentId: { type: 'string' },
                  classId: { type: 'string' },
                  date: { type: 'string', format: 'date' },
                  currentStatus: { type: 'string', enum: ['present', 'absent'] },
                  proposedStatus: { type: 'string', enum: ['present', 'absent'] },
                  reason: { type: 'string', minLength: 10, example: 'Student arrived late with bus delay certificate.' },
                },
                required: ['sessionId', 'studentId', 'classId', 'date', 'currentStatus', 'proposedStatus', 'reason'],
              },
            },
          },
        },
        responses: {
          '201': { description: 'Correction request submitted for Principal review.' },
        },
      },
    },
    '/api/attendance/corrections/{correctionId}/approve': {
      put: {
        tags: ['Corrections'],
        summary: 'Approve attendance correction',
        description: 'Principal or Developer approves the correction. Mutates attendance session record and appends immutable audit event.',
        operationId: 'approveCorrection',
        security: [{ StaffBearerAuth: [] }],
        parameters: [
          { name: 'correctionId', in: 'path', required: true, description: 'Correction Request ID', schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Correction approved and attendance ledger updated.' },
          '403': { description: 'Admin Office cannot approve its own correction request.' },
        },
      },
    },
    '/api/documents/upload': {
      post: {
        tags: ['Serverless Document APIs'],
        summary: 'Generate client upload token for Vercel Private Blob (Staff)',
        description: 'Vercel Serverless Function implementing @vercel/blob/client handleUpload protocol. Verifies staff Bearer auth against Cloud Firestore staff/{uid}. Admin and Developer roles authorized; Principal blocked from upload.',
        operationId: 'uploadStaffDocumentToken',
        security: [{ StaffBearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  type: { type: 'string', example: 'blob.generate-client-token' },
                  payload: {
                    type: 'object',
                    properties: {
                      pathname: { type: 'string', example: 'students/stu-10a-01/documents/birth_certificate/bc.pdf' },
                      callbackUrl: { type: 'string' },
                      clientPayload: { type: 'string' },
                    },
                  },
                },
                required: ['type'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Client upload token issued for Vercel Private Blob.' },
          '400': { description: 'Invalid pathname format or unapproved document slot.' },
          '401': { description: 'Missing or expired Bearer idToken.' },
          '403': { description: 'Forbidden. Principal has read-only oversight.' },
          '503': { description: 'Service Unavailable. Missing BLOB_READ_WRITE_TOKEN.' },
        },
      },
    },
    '/api/documents/file': {
      get: {
        tags: ['Serverless Document APIs'],
        summary: 'Stream private student document from Private Vercel Blob',
        description: 'Vercel Serverless Function verifying staff Bearer token against Cloud Firestore staff/{uid}. Authorized staff stream document securely without exposing raw blob URLs to browser history or referrers.',
        operationId: 'getPrivateDocumentFile',
        security: [{ StaffBearerAuth: [] }],
        parameters: [
          { name: 'pathname', in: 'query', required: true, description: 'Canonical storage path: students/{studentId}/documents/{docType}/{filename}', schema: { type: 'string', example: 'students/stu-10a-01/documents/birth_certificate/bc.pdf' } },
          { name: 'download', in: 'query', required: false, description: 'Set to "true" to force attachment download', schema: { type: 'string', example: 'true' } },
        ],
        responses: {
          '200': {
            description: 'Streaming document payload with anti-sniffing and cache-control headers.',
          },
          '400': { description: 'Invalid or non-canonical storage pathname format.' },
          '401': { description: 'Missing or expired Authorization Bearer header.' },
          '403': { description: 'Account suspended, deactivated, or unauthorized role.' },
          '404': { description: 'Document not found in Private Blob store.' },
        },
      },
    },
    '/api/documents/delete': {
      post: {
        tags: ['Serverless Document APIs'],
        summary: 'Delete private student document (Admin & Developer)',
        description: 'Vercel Serverless Function verifying Admin Office or Developer authority before invoking @vercel/blob del(). Principal role is rejected with 403.',
        operationId: 'deletePrivateDocument',
        security: [{ StaffBearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  pathname: { type: 'string', example: 'students/stu-10a-01/documents/transfer_certificate/tc.pdf' },
                },
                required: ['pathname'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Document deleted successfully from Private Blob store.' },
          '400': { description: 'Missing or invalid storage pathname.' },
          '403': { description: 'Principal role cannot delete documents.' },
        },
      },
    },
    '/api/documents/parent-verify': {
      post: {
        tags: ['Serverless Document APIs'],
        summary: 'Verify 256-bit parent invitation token and issue HMAC session',
        description: 'Dedicated server-side endpoint. Validates 256-bit cryptographically random token received via WhatsApp. Computes SHA-256 hash, verifies expiration (72h) and revocation status in Cloud Firestore using Google OAuth 2.0 service account credentials. Mints short-lived HMAC-SHA256 session token.',
        operationId: 'verifyParentToken',
        security: [{ ParentTokenAuth: [] }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  token: { type: 'string', description: '256-bit hex invitation token from WhatsApp link', example: 'a9f8b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Token verified. Returns student info, requested slots, and HMAC uploadSessionToken.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ParentVerificationResponse' },
              },
            },
          },
          '400': { description: 'Missing or malformed parent invitation token.' },
          '403': { description: 'Invitation token has expired, been revoked, or already completed.' },
          '405': { description: 'Method Not Allowed. Must use POST.' },
        },
      },
    },
    '/api/documents/parent-upload': {
      post: {
        tags: ['Serverless Document APIs'],
        summary: 'Parent upload handler for Vercel Private Blob (Zero-OTP)',
        description: 'Vercel Serverless Function implementing @vercel/blob/client handleUpload protocol for parents. Validates HMAC session token, checks live Firestore revocation status, restricts upload strictly to authorized student ID and permitted slots, and writes document metadata with uploadedByRole: "parent" via Google OAuth 2.0 service account.',
        operationId: 'uploadParentDocument',
        security: [{ ParentSessionAuth: [] }],
        parameters: [
          { name: 'x-parent-session-token', in: 'header', required: true, description: 'HMAC scoped upload session token', schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  type: { type: 'string', example: 'blob.generate-client-token' },
                  payload: {
                    type: 'object',
                    properties: {
                      pathname: { type: 'string', example: 'students/stu-10a-01/documents/birth_certificate/bc.pdf' },
                      clientPayload: { type: 'string' },
                    },
                  },
                },
                required: ['type'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Client upload token generated, or blob.upload-completed callback verified and metadata saved.' },
          '400': { description: 'Slot unpermitted, cross-student path tampering, or missing callback signature.' },
          '403': { description: 'Session expired or parent invitation revoked.' },
        },
      },
    },
    '/api/developer/health': {
      get: {
        tags: ['Developer & Diagnostics'],
        summary: 'System health probe',
        description: 'Performs deep health probes on Cloud Firestore, Vercel Blob Storage, Auth status, and WhatsApp Worker queue.',
        operationId: 'getHealthProbe',
        security: [{ StaffBearerAuth: [] }],
        responses: {
          '200': {
            description: 'System health metrics.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SystemHealthReport' },
              },
            },
          },
        },
      },
    },
  },
};
