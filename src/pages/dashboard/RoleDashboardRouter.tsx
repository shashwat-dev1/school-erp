/**
 * HanuJai High School ERP — Dynamic Role Dashboard Router
 * Resolves root route `/` to the authenticated user's dedicated workspace.
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PrincipalDashboard } from './PrincipalDashboard';
import { OfficeDashboard } from './OfficeDashboard';
import { ClassTeacherDashboard } from './ClassTeacherDashboard';
import { SubjectTeacherDashboard } from './SubjectTeacherDashboard';
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
    case 'admin':
      return <PrincipalDashboard />;
    case 'office_admin':
    case 'office_staff':
      return <OfficeDashboard />;
    case 'class_teacher':
      return <ClassTeacherDashboard />;
    case 'subject_teacher':
      return <SubjectTeacherDashboard />;
    default:
      return (
        <AccessDenied
          title="Access Restricted"
          message={`Your account (${currentUser.name}) has no assigned role. Please contact the school administrator.`}
        />
      );
  }
};
