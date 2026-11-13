/**
 * HanuJai High School ERP — Dynamic Role Dashboard Router
 * Resolves root route `/` to the authenticated user's dedicated workspace.
 * 
 * Active Roles:
 * - Principal -> Principal Executive Dashboard (Read-Only)
 * - Admin Office -> Admin Office Central Attendance & Operations Dashboard
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PrincipalDashboard } from './PrincipalDashboard';
import { AdminDashboard } from './AdminDashboard';
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
    case 'admin':
    case 'developer':
      return <AdminDashboard />;
    case 'class_teacher':
    case 'subject_teacher':
      return (
        <AccessDenied
          title="Role Deactivated in Phase 1"
          message="Classroom teacher accounts have been deactivated in this phase. Classroom attendance is entered centrally by the Admin Office."
        />
      );
    default:
      return (
        <AccessDenied
          title="Access Restricted"
          message={`Your account (${currentUser.name}) has no active authorized role. Please contact school administration.`}
        />
      );
  }
};
