import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Home } from 'lucide-react';

const Unauthorized = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white dark:bg-dark-card rounded-xl shadow-lg p-8 text-center border border-slate-200 dark:border-slate-700">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                    <ShieldAlert size={32} className="text-red-500 dark:text-red-400" />
                </div>

                <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Access Denied</h1>
                <p className="text-slate-500 dark:text-slate-400 mb-8">
                    You do not have permission to view this page. Please contact your administrator if you believe this is an error.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <Home size={18} />
                        Go to Dashboard
                    </button>
                    <button
                        onClick={() => navigate(-1)}
                        className="px-6 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium rounded-lg transition-colors"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Unauthorized;
