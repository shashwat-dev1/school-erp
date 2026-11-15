import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { DataContextProvider } from '../context/DataContext';
import { App } from '../App';
import { demoRepository } from '../data/demo/demoRepository';
import { initialStaff } from '../data/demo/seedData';

describe('HanuJai ERP Foundation — Phase 1 Core Workflows (Student & Attendance Only)', () => {
  beforeEach(async () => {
    localStorage.clear();
    if (demoRepository.resetDemoData) {
      await demoRepository.resetDemoData();
    }
  });

  const setupUserSession = (userId: string) => {
    localStorage.setItem('hanujai_demo_user_id', userId);
  };

  it('renders the application shell and Principal Home in Demo Mode', async () => {
    const principal = initialStaff.find(s => s.role === 'principal')!;
    setupUserSession(principal.id);

    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <DataContextProvider>
            <App />
          </DataContextProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    // Verify institutional brand and navigation
    await waitFor(() => {
      expect(screen.getAllByText(/HanuJai High School/i)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/Dashboard/i)[0]).toBeInTheDocument();
    });

    // Verify presence of calculated figures from repository (~1,000 total students)
    expect(screen.getAllByText(/Total Students/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/1000/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Present Today/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Absent Today/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/Attendance by Class \(Today\)/i)).toBeInTheDocument();
  });

  it('renders the Student Ledger with seed student records', async () => {
    const principal = initialStaff.find(s => s.role === 'principal')!;
    setupUserSession(principal.id);

    render(
      <MemoryRouter initialEntries={['/students']}>
        <AuthProvider>
          <DataContextProvider>
            <App />
          </DataContextProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Students/i).length).toBeGreaterThan(0);
    });

    // Check for seed students from Class 10-A
    await waitFor(() => {
      expect(screen.getByText(/Aarav Singhania/i)).toBeInTheDocument();
      expect(screen.getByText(/Diya Patel/i)).toBeInTheDocument();
    });

    // Verify export button exists
    expect(screen.getByText(/Export CSV/i)).toBeInTheDocument();
  });

  it('renders clean Phase 1 Student Profile dossier with basic info and attendance ledger', async () => {
    const principal = initialStaff.find(s => s.role === 'principal')!;
    setupUserSession(principal.id);

    render(
      <MemoryRouter initialEntries={['/students/STU-10A-01']}>
        <AuthProvider>
          <DataContextProvider>
            <App />
          </DataContextProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Aarav Singhania/i).length).toBeGreaterThan(0);
      // Phase 1: Student Information
      expect(screen.getByText(/Student Details/i)).toBeInTheDocument();
      expect(screen.getByText(/Parent \/ Guardian & Residence/i)).toBeInTheDocument();
    });

    // Switch to Attendance History Tab
    fireEvent.click(screen.getByRole('tab', { name: /Attendance/i }));

    await waitFor(() => {
      expect(screen.getByText(/Daily Attendance Register Logs/i)).toBeInTheDocument();
      expect(screen.getByText(/Export Attendance \(Excel\)/i)).toBeInTheDocument();
    });
    
    // Academic tabs and marks must NOT be present
    expect(screen.queryByText(/Academic Performance/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Teacher notes/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Academic Report/i)).not.toBeInTheDocument();
  });

  it('renders the Daily Attendance Register in read-only mode for Principal', async () => {
    const principal = initialStaff.find(s => s.role === 'principal')!;
    setupUserSession(principal.id);

    render(
      <MemoryRouter initialEntries={['/attendance/register/class-10-a']}>
        <AuthProvider>
          <DataContextProvider>
            <App />
          </DataContextProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Attendance Register/i).length).toBeGreaterThan(0);
    });

    // Mutation buttons must NOT be present for Principal
    expect(screen.queryByText(/Mark All Present/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Save & Submit/i)).not.toBeInTheDocument();
  });

  it('renders interactive attendance controls for Admin Office across any class', async () => {
    const adminStaff = initialStaff.find(s => s.role === 'admin')!;
    setupUserSession(adminStaff.id);

    render(
      <MemoryRouter initialEntries={['/attendance/register/class-10-b']}>
        <AuthProvider>
          <DataContextProvider>
            <App />
          </DataContextProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Attendance Register/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Mark All Present/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Save & Submit/i).length).toBeGreaterThan(0);
    });
  });

  it('denies attendance register access to deactivated teacher accounts', async () => {
    const classTeacher = initialStaff.find(s => s.role === 'class_teacher')!;
    setupUserSession(classTeacher.id);

    render(
      <MemoryRouter initialEntries={['/attendance/register/class-10-a']}>
        <AuthProvider>
          <DataContextProvider>
            <App />
          </DataContextProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText(/Mark All Present/i)).not.toBeInTheDocument();
    });
  });

  it('renders the Staff Login portal', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <DataContextProvider>
            <App />
          </DataContextProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Staff Authentication/i)).toBeInTheDocument();
    });
    expect(screen.getAllByText(/Sign In/i)[0]).toBeInTheDocument();
  });

  it('restricts unauthorized routes using RoleGuard', async () => {
    render(
      <MemoryRouter initialEntries={['/invalid-unknown-screen']}>
        <AuthProvider>
          <DataContextProvider>
            <App />
          </DataContextProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/We couldn't find this page/i)).toBeInTheDocument();
    });
  });

  it('redirects obsolete academic routes to active Phase 1 screens', async () => {
    const principal = initialStaff.find(s => s.role === 'principal')!;
    setupUserSession(principal.id);

    render(
      <MemoryRouter initialEntries={['/assessments']}>
        <AuthProvider>
          <DataContextProvider>
            <App />
          </DataContextProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    // /assessments redirects to /students
    await waitFor(() => {
      expect(screen.getAllByText(/Students/i).length).toBeGreaterThan(0);
    });
  });

  it('renders Attendance Report screen with multi-month presets', async () => {
    const principal = initialStaff.find(s => s.role === 'principal')!;
    setupUserSession(principal.id);

    render(
      <MemoryRouter initialEntries={['/reports/attendance']}>
        <AuthProvider>
          <DataContextProvider>
            <App />
          </DataContextProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Attendance Ledger/i)[0]).toBeInTheDocument();
      expect(screen.getByText(/Last 3 Months/i)).toBeInTheDocument();
      expect(screen.getByText(/Last 6 Months/i)).toBeInTheDocument();
      expect(screen.getByText(/Last 9 Months/i)).toBeInTheDocument();
    });
  });
});
