/**
 * HanuJai High School ERP — Dynamic Role Dashboard Router
 * Resolves root route `/` to the authenticated user's dedicated workspace.
 */

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { PrincipalDashboard } from './PrincipalDashboard';
import { OfficeDashboard } from './OfficeDashboard';
import { ClassTeacherDashboard } from './ClassTeacherDashboard';
import { SubjectTeacherDashboard } from './SubjectTeacherDashboard';
import { LoadingState } from '../../components/feedback/LoadingState';

export const RoleDashboardRouter: React.FC = () => {
  const { currentUser, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingState message="Routing to authorized institutional desk..." />;
  }

  if (!currentUser) {
    return <PrincipalDashboard />;
  }

  switch (currentUser.role) {
    case 'principal':
      return <PrincipalDashboard />;
    case 'office_admin':
      return <OfficeDashboard />;
    case 'class_teacher':
      return <ClassTeacherDashboard />;
    case 'subject_teacher':
      return <SubjectTeacherDashboard />;
    default:
      return <PrincipalDashboard />;
  }
};
