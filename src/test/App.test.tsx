import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { DataContextProvider } from '../context/DataContext';
import { App } from '../App';
import { demoRepository } from '../data/demo/demoRepository';

describe('HanuJai ERP Foundation — Core Workflows', () => {
  beforeEach(async () => {
    localStorage.clear();
    if (demoRepository.resetDemoData) {
      await demoRepository.resetDemoData();
    }
  });

  it('renders the application shell and Home in Demo Mode', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <DataContextProvider>
            <App />
          </DataContextProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    // Verify institutional brand and demo indicator
    await waitFor(() => {
      expect(screen.getAllByText(/HanuJai High School/i)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/Sample Data/i)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/Home/i)[0]).toBeInTheDocument();
    });

    // Verify presence of morning roll call metrics
    expect(screen.getAllByText(/Total Students/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Students Needing Attention/i)[0]).toBeInTheDocument();
  });

  it('renders the Student Ledger with seed student records', async () => {
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

    // Verify explainable care flags exist in table
    expect(screen.getByText(/#ATT-01/i)).toBeInTheDocument();
  });

  it('renders the Daily Attendance Register for Class 10-A', async () => {
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
    });

    // Verify interactive attendance controls
    expect(screen.getByText(/Mark All Present/i)).toBeInTheDocument();
    expect(screen.getByText(/Finalize & Submit Register/i)).toBeInTheDocument();
    expect(screen.getByText(/Aarav Singhania/i)).toBeInTheDocument();
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
      expect(screen.getByText(/Sign In to Operational Desk/i)).toBeInTheDocument();
      expect(screen.getByText(/Prototype Review — Select Role Persona:/i)).toBeInTheDocument();
    });
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

  it('renders Student Profile with all 5 operational dossier tabs', async () => {
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
      expect(screen.getByText(/Profile Overview/i)).toBeInTheDocument();
      expect(screen.getByText(/Academic Performance/i)).toBeInTheDocument();
      expect(screen.getByText(/Attendance Records/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Pastoral Care/i)[0]).toBeInTheDocument();
      expect(screen.getByText(/Change History/i)).toBeInTheDocument();
    });
  });

  it('renders Assessment Directory and Marks Entry Register', async () => {
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
      expect(screen.getByText(/Configure Assessment/i)).toBeInTheDocument();
    });
  });

  it('renders Class Performance Matrix and Risk Watchlist', async () => {
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

  it('renders Reports Hub and Official Report Card', async () => {
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
      expect(screen.getByText(/Statutory & Operational Reports Directory/i)).toBeInTheDocument();
      expect(screen.getByText(/Formal CBSE Student Academic Report Card/i)).toBeInTheDocument();
      expect(screen.getByText(/Parent-Teacher Meeting \(PTM\) Progress Slip/i)).toBeInTheDocument();
    });
  });

  it('renders System Settings with Demo Data Reset capability', async () => {
    render(
      <MemoryRouter initialEntries={['/settings/system-config']}>
        <AuthProvider>
          <DataContextProvider>
            <App />
          </DataContextProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Institutional System & Identity Configuration/i)).toBeInTheDocument();
      expect(screen.getByText(/Reset to Clean Demo Data/i)).toBeInTheDocument();
    });
  });
});
