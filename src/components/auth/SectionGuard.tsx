/**
 * HanuJai High School ERP — Section & Assignment Access Guard
 * Verifies that the authenticated user has legitimate assignment clearance
 * for the requested class section URL parameter.
 */

import React from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Permissions } from '../../domain/permissions';
import { AccessDenied } from '../../pages/error/AccessDenied';

interface SectionGuardProps {
  action?: 'view' | 'mark_attendance';
  children: React.ReactNode;
}

export const SectionGuard: React.FC<SectionGuardProps> = ({ action = 'view', children }) => {
  const { classId } = useParams<{ classId: string }>();
  const { currentUser } = useAuth();

  if (!classId) {
    return <>{children}</>;
  }

  if (action === 'mark_attendance') {
    if (!Permissions.canMarkAttendance(currentUser, classId)) {
      return (
        <AccessDenied
          title="Attendance Roll-Call Unauthorized"
          message={`You are not authorized to mark attendance for section (${classId}). Only the designated Class Tutor or Principal can mark this register.`}
        />
      );
    }
  } else {
    if (!Permissions.canAccessSection(currentUser, classId)) {
      return (
        <AccessDenied
          title="Section Clearance Boundary"
          message={`You are not authorized to view or administer records for section (${classId}). Access is restricted to assigned faculty and administrative leadership.`}
        />
      );
    }
  }

  return <>{children}</>;
};
