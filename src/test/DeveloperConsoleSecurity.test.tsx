import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { DataContextProvider } from '../context/DataContext';
import { App } from '../App';
import { demoRepository } from '../data/demo/demoRepository';
import { initialStaff, defaultDeveloperUser } from '../data/demo/seedData';
import { Permissions } from '../domain/permissions';
import { DeveloperService } from '../services/developer/developerService';
import type { StaffUser } from '../domain/types';

describe('HANUJAI ERP — Developer Role & Console Security Test Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
    if (demoRepository.resetDemoData) {
      await demoRepository.resetDemoData();
    }
  });

  const setupUserSession = (staffUser: StaffUser) => {
    localStorage.setItem('hanujai_demo_user_id', staffUser.id);
  };

  const getPrincipal = () => initialStaff.find(s => s.role === 'principal')!;
  const getAdmin = () => initialStaff.find(s => s.role === 'admin' && s.status === 'active')!;
  const getDeveloper = () => defaultDeveloperUser;

  describe('1. Route-Level Role Authorization & Developer Console Protection', () => {
    it('Principal attempting to navigate to /developer is denied access (HTTP 403 equivalent)', async () => {
      const principal = getPrincipal();
      setupUserSession(principal);

      render(
        <MemoryRouter initialEntries={['/developer']}>
          <AuthProvider>
            <DataContextProvider>
              <App />
            </DataContextProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Desk Authorization Policy/i })).toBeInTheDocument();
        expect(screen.queryByText(/Developer & System Administrator Console/i)).not.toBeInTheDocument();
      });
    });

    it('Admin Office attempting to navigate to /developer is denied access (HTTP 403 equivalent)', async () => {
      const admin = getAdmin();
      setupUserSession(admin);

      render(
        <MemoryRouter initialEntries={['/developer']}>
          <AuthProvider>
            <DataContextProvider>
              <App />
            </DataContextProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Desk Authorization Policy/i })).toBeInTheDocument();
        expect(screen.queryByText(/Developer & System Administrator Console/i)).not.toBeInTheDocument();
      });
    });

    it('Developer can access /developer and view the master Developer Console', async () => {
      const dev = getDeveloper();
      setupUserSession(dev);

      render(
        <MemoryRouter initialEntries={['/developer']}>
          <AuthProvider>
            <DataContextProvider>
              <App />
            </DataContextProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Developer & System Administrator Console/i)).toBeInTheDocument();
        expect(screen.getByText(/Student Data Import/i)).toBeInTheDocument();
        expect(screen.getByText(/User & Role Management/i)).toBeInTheDocument();
      });
    });
  });

  describe('2. Authoritative Domain Permissions Verification', () => {
    it('only active developer can access Developer Console permissions', () => {
      const dev = getDeveloper();
      const admin = getAdmin();
      const principal = getPrincipal();

      expect(Permissions.canAccessDeveloperConsole(dev)).toBe(true);
      expect(Permissions.canAccessDeveloperConsole(admin)).toBe(false);
      expect(Permissions.canAccessDeveloperConsole(principal)).toBe(false);
      expect(Permissions.canAccessDeveloperConsole(null)).toBe(false);

      expect(Permissions.canImportStudents(dev)).toBe(true);
      expect(Permissions.canImportStudents(admin)).toBe(true);
      expect(Permissions.canImportStudents(principal)).toBe(false);

      expect(Permissions.canManageDatabase(dev)).toBe(true);
      expect(Permissions.canManageDatabase(admin)).toBe(false);
      expect(Permissions.canManageDatabase(principal)).toBe(false);

      expect(Permissions.canManageStaff(dev)).toBe(true);
      expect(Permissions.canManageStaff(admin)).toBe(false);
    });

    it('developer has full document management privileges alongside admin', () => {
      const dev = getDeveloper();
      const principal = getPrincipal();

      expect(Permissions.canViewStudentDocuments(dev)).toBe(true);
      expect(Permissions.canDownloadStudentDocument(dev)).toBe(true);
      expect(Permissions.canUploadStudentDocument(dev)).toBe(true);
      expect(Permissions.canDeleteStudentDocument(dev)).toBe(true);

      // Principal remains strictly read-only
      expect(Permissions.canUploadStudentDocument(principal)).toBe(false);
      expect(Permissions.canDeleteStudentDocument(principal)).toBe(false);
    });
  });

  describe('3. Last Developer Safeguard Protection', () => {
    it('blocks deactivating the last active developer account', () => {
      const staffList: StaffUser[] = [
        getDeveloper(),
        getPrincipal(),
        getAdmin(),
      ];

      expect(() => {
        DeveloperService.validateStaffModificationSafeguard(
          'staff-dev',
          undefined,
          'deactivated',
          staffList
        );
      }).toThrow(/Cannot demote or deactivate the last active Developer account/i);
    });

    it('blocks changing the role of the last active developer account', () => {
      const staffList: StaffUser[] = [
        getDeveloper(),
        getPrincipal(),
        getAdmin(),
      ];

      expect(() => {
        DeveloperService.validateStaffModificationSafeguard(
          'staff-dev',
          'admin',
          undefined,
          staffList
        );
      }).toThrow(/Cannot demote or deactivate the last active Developer account/i);
    });

    it('permits deactivating a developer when another active developer exists', () => {
      const secondDev: StaffUser = {
        ...getDeveloper(),
        id: 'staff-dev-2',
        email: 'dev2@hanujai.edu.in',
      };
      const staffList: StaffUser[] = [
        getDeveloper(),
        secondDev,
        getPrincipal(),
        getAdmin(),
      ];

      expect(() => {
        DeveloperService.validateStaffModificationSafeguard(
          'staff-dev-2',
          undefined,
          'deactivated',
          staffList
        );
      }).not.toThrow();
    });
  });
});
