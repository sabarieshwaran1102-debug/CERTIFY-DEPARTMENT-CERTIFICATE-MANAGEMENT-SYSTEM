import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import ProtectedRoute from '../components/Layout/ProtectedRoute';
import { AuthContext } from '../context/AuthContext';
import authService from '../services/authService';

vi.mock('../services/authService', () => ({
  default: {
    login: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

describe('Authentication flow', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('requires a student username as register number and password as DOB in the login flow', async () => {
    const user = userEvent.setup();
    const login = vi.fn();
    authService.login.mockResolvedValue({
      token: 'student-token',
      user: { role: 'student', username: '2024001' },
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthContext.Provider value={{ login, user: null, token: null, loading: false, logout: vi.fn(), isAuthenticated: false }}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText(/enter register number/i), '2024001');
    await user.type(screen.getByLabelText(/date of birth/i), '2005-06-15');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith({
        username: '2024001',
        password: '2005-06-15',
        role: 'student',
      });
    });
    expect(login).toHaveBeenCalledWith('student-token', { role: 'student', username: '2024001' });
  });

  it('redirects unauthorized users away from protected student pages', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthContext.Provider value={{ user: { role: 'student_representative' }, token: 'token', loading: false, login: vi.fn(), logout: vi.fn(), isAuthenticated: true }}>
          <Routes>
            <Route path="/" element={<ProtectedRoute requiredRole="student"><div>Student page</div></ProtectedRoute>} />
            <Route path="/unauthorized" element={<div>Unauthorized</div>} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>
    );

    expect(await screen.findByText(/unauthorized/i)).toBeInTheDocument();
  });

  it('redirects unauthenticated users to login when they try to access protected routes', async () => {
    render(
      <MemoryRouter initialEntries={['/student']}>
        <AuthContext.Provider value={{ user: null, token: null, loading: false, login: vi.fn(), logout: vi.fn(), isAuthenticated: false }}>
          <Routes>
            <Route path="/student" element={<ProtectedRoute requiredRole="student"><div>Student page</div></ProtectedRoute>} />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>
    );

    expect(await screen.findByText(/login page/i)).toBeInTheDocument();
  });
});
