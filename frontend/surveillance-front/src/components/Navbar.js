import React from 'react';
import { Link, useLocation } from 'react-router-dom';
// The Navbar will use 'Link' from react-router-dom, which is imported above.

const Navbar = () => {
    const location = useLocation();

    // Reusable Link Component for consistent styling and active state
    const NavLink = ({ to, children }) => {
        const isActive = location.pathname === to;
        const baseClasses = "px-3 py-2 rounded-md text-sm font-medium transition duration-150 ease-in-out";
        const activeClasses = "bg-indigo-700 text-white shadow-md";
        const inactiveClasses = "text-indigo-200 hover:bg-indigo-600 hover:text-white";

        return (
            <Link to={to} className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}>
                {children}
            </Link>
        );
    };

    return (
        // Tailwind Navbar structure
        <nav className="bg-indigo-800 shadow-xl mb-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    
                    {/* Brand/Logo Section */}
                    <div className="flex items-center space-x-3">
                        {/* Logo Placeholder */}
                        <div className="flex-shrink-0">
                            {/* Replace this div with a proper <img src="..." /> tag */}
                            <div className="h-7 w-7 bg-indigo-500 rounded-full flex items-center justify-center text-xs font-bold text-white border border-indigo-200">
                                $
                            </div>
                        </div>
                        
                        {/* Brand Name */}
                        <Link className="text-xl font-bold text-white tracking-wider" to="/">
                            Exams FSEGS
                        </Link>
                    </div>

                    {/* Navigation Links (Desktop) */}
                    <div className="hidden sm:ml-6 sm:block">
                        <div className="flex space-x-4">
                            <NavLink to="/">
                                🧑‍🏫 Teacher Dashboard
                            </NavLink>
                            <NavLink to="/admin">
                                ⚙️ Admin / Assignments
                            </NavLink>
                        </div>
                    </div>

                    {/* Mobile Menu Button (Hamburger - hidden for simplicity, but structure allows it) */}
                    <div className="-mr-2 flex sm:hidden">
                        {/* Typically a button to toggle a mobile menu */}
                        <button 
                            type="button" 
                            className="inline-flex items-center justify-center p-2 rounded-md text-indigo-200 hover:text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-indigo-800 focus:ring-white"
                            aria-controls="mobile-menu" 
                            aria-expanded="false"
                        >
                            {/* Icon placeholder */}
                            <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                    </div>

                </div>
            </div>

            {/* Mobile Menu (Hidden by default, can be toggled via state) */}
            <div className="sm:hidden" id="mobile-menu">
                <div className="px-2 pt-2 pb-3 space-y-1">
                    <NavLink to="/">
                        🧑‍🏫 Teacher Dashboard
                    </NavLink>
                    <NavLink to="/admin">
                        ⚙️ Admin / Assignments
                    </NavLink>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;