const fs = require('fs');
const file = 'C:/Projects/School/hanujai-erp/src/pages/attendance/DailyAttendanceRegister.tsx';
let content = fs.readFileSync(file, 'utf8');

const sIdx = content.indexOf('{/* WHATSAPP PARENT NOTIFICATIONS STATUS PANEL (PHASE 1 CORE) */}');
const eIdx = content.indexOf('{/* MODE 2: ATTENDANCE HISTORY & EXCEL EXPORT (PRESERVED) */}');

if (sIdx !== -1 && eIdx !== -1) {
  // Find the start of the comment before sIdx
  const blockStart = content.lastIndexOf('{/*', sIdx);
  // Find the end of the block before eIdx
  const blockEnd = content.lastIndexOf('{/*', eIdx);

  const replacement = `          {/* WhatsApp Parent Notification Confirmation (Runs in background) */}
          {isSessionActuallySaved && (
            <div
              style={{
                padding: '14px 18px',
                borderRadius: 'var(--hhs-radius-container)',
                backgroundColor: '#ECFDF5',
                border: '1px solid #A7F3D0',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <CheckCircle size={18} color="#10B981" />
              <span style={{ fontSize: '0.84rem', color: '#065F46', fontWeight: 600 }}>
                Attendance register submitted. Automated WhatsApp parent notifications for Present and Absent students are queued in the background.
              </span>
            </div>
          )}
        </>
      )}

      `;

  content = content.slice(0, blockStart) + replacement + content.slice(blockEnd);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully updated DailyAttendanceRegister.tsx');
} else {
  console.error('Markers not found: sIdx =', sIdx, ', eIdx =', eIdx);
}

