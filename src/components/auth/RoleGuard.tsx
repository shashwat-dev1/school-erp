import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { StaffRole } from '../../domain/types';
import { LoadingState } from '../feedback/LoadingState';

interface RoleGuardProps {
  allowedRoles?: StaffRole[];
  children?: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children }) => {
  const { currentUser, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ padding: '64px 0', display: 'flex', justifyContent: 'center' }}>
        <LoadingState message="Verifying institutional credentials & desk authorization..." />
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/access-denied" replace />;
  }

  return children ? <>{children}</> : null;
};
