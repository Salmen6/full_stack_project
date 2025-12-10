import React, { createContext, useState, useContext } from 'react';
import ExamService from '../services/ExamService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);

    const login = (userData) => {
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('user');
    };

    /**
     * NEW: Refresh user data from backend
     * This ensures we always have the latest teacher data including new assignments
     */
    const refreshUser = async () => {
        if (!user?.id_user) return;

        try {
            // Fetch fresh teacher data
            const res = await ExamService.getEnseignantByUserId(user.id_user);
            const teacherData = res.data;

            // Update user object with fresh data
            const updatedUser = {
                ...user,
                enseignantDTO: teacherData,
                nomComplet: teacherData?.nomComplet || user.nomComplet
            };

            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
            
            return updatedUser;
        } catch (error) {
            console.error('Failed to refresh user data:', error);
            return user;
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);