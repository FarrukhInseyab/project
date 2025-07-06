import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';

export const LoadingSpinner: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center mobile-container">
      <div className="text-center px-4">
        <div className="flex items-center justify-center space-x-2 sm:space-x-3 mb-4 sm:mb-6">
          <img 
            src="/go-ar-logo.png" 
            alt="Go-AR Logo" 
            className="h-10 sm:h-12 w-auto"
          />
          <div className="h-6 sm:h-8 w-px bg-gray-300"></div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Document AI Studio
            </h1>
          </div>
        </div>
        
        <div className="flex items-center justify-center space-x-2 mb-3 sm:mb-4">
          <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 animate-spin" />
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 animate-pulse" />
        </div>
        
        <p className="text-sm sm:text-base text-gray-600 font-medium">Loading your workspace...</p>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">Preparing AI-powered document processing</p>
      </div>
    </div>
  );
};