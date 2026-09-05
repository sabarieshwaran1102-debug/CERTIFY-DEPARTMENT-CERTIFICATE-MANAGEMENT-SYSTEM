import { createContext, useState, useCallback, useEffect } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState(localStorage.getItem('token'));

    useEffect(() => {
        // Check if user is already logged in
        const storedToken = localStorage.getItem('token');
        if (storedToken) {
            setToken(storedToken);
            // TODO: Verify token with backend in Phase 5
        }
        setLoading(false);
    }, []);

    const login = useCallback((token, user) => {
        localStorage.setItem('token', token);
        setToken(token);
        setUser(user);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
    }, []);

    const value = {
        user,
        token,
        loading,
        login,
        logout,
        isAuthenticated: !!token,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
