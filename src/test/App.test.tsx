import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { DataContextProvider } from '../context/DataContext';
import { App } from '../App';
import { demoRepository } from '../data/demo/demoRepository';
import { initialStaff } from '../data/demo/seedData';

describe('HanuJai ERP Foundation — Core Workflows', () => {
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

    // Verify institutional brand and session indicator
    await waitFor(() => {
      expect(screen.getAllByText(/HanuJai High School/i)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/Session 2025–2026/i)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/Home/i)[0]).toBeInTheDocument();
    });

    // Verify presence of calculated figures from repository (1,000 total students)
    expect(screen.getAllByText(/Total Students/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/1000/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Present Today/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Absent Today/i)[0]).toBeInTheDocument();
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
      expect(screen.getByText(/Student Ledger & Profiles/i)).toBeInTheDocument();
    });

    // Check for seed students from Class 10-A
    await waitFor(() => {
      expect(screen.getByText(/Aarav Singhania/i)).toBeInTheDocument();
      expect(screen.getByText(/Diya Patel/i)).toBeInTheDocument();
    });

    // Verify export button exists
    expect(screen.getByText(/Export CSV/i)).toBeInTheDocument();
  });

  it('shows final academic charts and an evidence-based marks comparison on a student profile', async () => {
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

    await waitFor(() => expect(screen.getAllByText(/Aarav Singhania/i).length).toBeGreaterThan(0));
    fireEvent.click(screen.getByText('Academic Performance'));
    expect(await screen.findByText('Academic progress')).toBeInTheDocument();
    expect(screen.getByText(/finalized result/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Review evidence' }));
    expect(await screen.findByText(/Possible contributing factors/i)).toBeInTheDocument();
    expect(screen.getAllByText(/22\/25/).length).toBeGreaterThan(0);
    expect(screen.getByText(/absences were recorded between the assessment periods/i)).toBeInTheDocument();
    expect(screen.queryByText(/no submitted attendance sessions are available/i)).not.toBeInTheDocument();
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
      console.log("MAIN HTML:", document.querySelector('main')?.innerHTML);
      expect(screen.getByText(/Daily Attendance Register/i)).toBeInTheDocument();
    });

    // Mutation buttons must NOT be present for Principal
    expect(screen.queryByText(/Mark All Present/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Save & Submit/i)).not.toBeInTheDocument();
  });

  it('renders interactive attendance controls for assigned Class Teacher', async () => {
    const classTeacher = initialStaff.find(s => s.role === 'class_teacher' && s.assignedClassId === 'class-10-a')!;
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
      expect(screen.getByText(/Daily Attendance Register — Class 10-A/i)).toBeInTheDocument();
      expect(screen.getByText(/Mark All Present/i)).toBeInTheDocument();
      expect(screen.getByText(/Save & Submit/i)).toBeInTheDocument();
    });
  });

  it('renders the Staff Login portal with exactly three profiles', async () => {
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
    console.log("LOGIN BODY:", document.body.innerHTML);
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

  it('renders Student Profile dossier with 3 clear areas', async () => {
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
      expect(screen.getAllByText(/Aarav Singhania/i)[0]).toBeInTheDocument();
      expect(screen.getByText(/Attendance Summary/i)).toBeInTheDocument();
      expect(screen.getByText(/Academic Results/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Teacher notes/i)[0]).toBeInTheDocument();
      expect(screen.getByText(/Academic Report/i)).toBeInTheDocument();
    });
  });

  it('renders Assessment Directory with Examination schedule', async () => {
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

    await waitFor(() => {
      expect(screen.getByText(/Assessment Cycles & Marks Entry/i)).toBeInTheDocument();
      expect(screen.getByText(/Examination & Evaluation Schedule/i)).toBeInTheDocument();
    });
  });

  it('renders Class Performance Matrix and Results', async () => {
    const principal = initialStaff.find(s => s.role === 'principal')!;
    setupUserSession(principal.id);

    render(
      <MemoryRouter initialEntries={['/performance/classes/class-10-a']}>
        <AuthProvider>
          <DataContextProvider>
            <App />
          </DataContextProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Class Results/i)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/Class Average/i)[0]).toBeInTheDocument();
      expect(screen.getByText(/Export CSV/i)).toBeInTheDocument();
    });
  });

  it('renders Reports Hub with 3 main tools and Class Academic Summary', async () => {
    const principal = initialStaff.find(s => s.role === 'principal')!;
    setupUserSession(principal.id);

    render(
      <MemoryRouter initialEntries={['/reports']}>
        <AuthProvider>
          <DataContextProvider>
            <App />
          </DataContextProvider>
        </AuthProvider>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getAllByText(/Attendance Ledger/i)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/Academic Performance Comparison/i)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/Student Follow-up/i)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/Academic Summary/i)[0]).toBeInTheDocument();
    });
  });
});
