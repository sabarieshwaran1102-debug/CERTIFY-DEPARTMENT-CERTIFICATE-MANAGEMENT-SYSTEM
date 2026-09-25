import { createContext, useState, useCallback, useEffect } from 'react';
import authService from '../services/authService';
import { tokenStore } from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState(tokenStore.get());

    useEffect(() => {
        const storedToken = tokenStore.get();
        if (storedToken) {
            setToken(storedToken);
            authService.getCurrentUser()
                .then((currentUser) => setUser(currentUser))
                .catch(() => {
                    tokenStore.remove();
                    setToken(null);
                    setUser(null);
                })
                .finally(() => setLoading(false));
            return;
        }
        setLoading(false);
    }, []);

    const login = useCallback((tokenValue, userData) => {
        tokenStore.set(tokenValue);
        setToken(tokenValue);
        setUser(userData);
    }, []);

    const logout = useCallback(() => {
        tokenStore.remove();
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
