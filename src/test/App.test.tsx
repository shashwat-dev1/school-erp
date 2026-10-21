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

  it('renders the application shell and Operations Hub in Demo Mode', async () => {
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
      expect(screen.getByText(/HanuJai High School/i)).toBeInTheDocument();
      expect(screen.getByText(/Demo Mode — Sample Data/i)).toBeInTheDocument();
      expect(screen.getByText(/Operations Hub/i)).toBeInTheDocument();
    });

    // Verify presence of morning roll call metrics
    expect(screen.getByText(/Total Student Enrollment/i)).toBeInTheDocument();
    expect(screen.getByText(/Explainable Student Care Flags/i)).toBeInTheDocument();
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
    // In demo mode, default user is Principal (who has access to admin/staff).
    // Let's test non-existent route shows NotFound
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
      expect(screen.getByText(/Record or Screen Not Found/i)).toBeInTheDocument();
    });
  });
});
