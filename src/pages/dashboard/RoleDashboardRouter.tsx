/**
 * HanuJai High School ERP — Dynamic Role Dashboard Router
 * Resolves root route `/` to the authenticated user's dedicated workspace.
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PrincipalDashboard } from './PrincipalDashboard';
import { ClassTeacherDashboard } from './ClassTeacherDashboard';
import { LoadingState } from '../../components/feedback/LoadingState';
import { AccessDenied } from '../error/AccessDenied';

export const RoleDashboardRouter: React.FC = () => {
  const { currentUser, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingState message="Loading your workspace..." />;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  switch (currentUser.role) {
    case 'principal':
      return <PrincipalDashboard />;
    case 'class_teacher':
      return <ClassTeacherDashboard />;
    case 'subject_teacher':
      return (
        <AccessDenied
          title="Role Restricted in Phase 1"
          message="Subject Teacher access is not active in Phase 1. HanuJai ERP Phase 1 focuses exclusively on Student Information and Daily Attendance for the Principal and designated Class Teachers."
        />
      );
    default:
      return (
        <AccessDenied
          title="Access Restricted"
          message={`Your account (${currentUser.name}) has no valid role assigned for this pilot. Please contact school administration.`}
        />
      );
  }
};
