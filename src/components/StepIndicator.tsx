import React from 'react';
import { Check, FileText, Tags, Database, Zap, ArrowRight } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: number;
  onStepClick: (step: number) => void;
}

const steps = [
  { 
    id: 0, 
    title: 'Upload Document', 
    shortTitle: 'Upload',
    description: 'Upload and edit your Word document',
    icon: FileText,
    color: 'blue'
  },
  { 
    id: 1, 
    title: 'Manage Tags', 
    shortTitle: 'Tags',
    description: 'AI-extracted tags and customization',
    icon: Tags,
    color: 'emerald'
  },
  { 
    id: 1.5, 
    title: 'Map Columns', 
    shortTitle: 'Map',
    description: 'Connect tags to database columns',
    icon: ArrowRight,
    color: 'purple'
  },
  { 
    id: 2, 
    title: 'Import Data', 
    shortTitle: 'Data',
    description: 'Smart data mapping and auto-population',
    icon: Database,
    color: 'indigo'
  },
  { 
    id: 3, 
    title: 'Generate Documents', 
    shortTitle: 'Generate',
    description: 'Download populated documents instantly',
    icon: Zap,
    color: 'orange'
  },
];

const colorClasses = {
  blue: {
    active: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25',
    completed: 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25',
    inactive: 'bg-white text-gray-500 border-2 border-gray-200 hover:border-blue-300 hover:text-blue-600',
    line: 'bg-gradient-to-r from-blue-500 to-blue-600'
  },
  emerald: {
    active: 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25',
    completed: 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25',
    inactive: 'bg-white text-gray-500 border-2 border-gray-200 hover:border-emerald-300 hover:text-emerald-600',
    line: 'bg-gradient-to-r from-emerald-500 to-emerald-600'
  },
  purple: {
    active: 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/25',
    completed: 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25',
    inactive: 'bg-white text-gray-500 border-2 border-gray-200 hover:border-purple-300 hover:text-purple-600',
    line: 'bg-gradient-to-r from-purple-500 to-purple-600'
  },
  indigo: {
    active: 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/25',
    completed: 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25',
    inactive: 'bg-white text-gray-500 border-2 border-gray-200 hover:border-indigo-300 hover:text-indigo-600',
    line: 'bg-gradient-to-r from-indigo-500 to-indigo-600'
  },
  orange: {
    active: 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/25',
    completed: 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25',
    inactive: 'bg-white text-gray-500 border-2 border-gray-200 hover:border-orange-300 hover:text-orange-600',
    line: 'bg-gradient-to-r from-orange-500 to-orange-600'
  }
};

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, onStepClick }) => {
  return (
    <div className="mb-6 sm:mb-12">
      {/* Mobile Step Indicator - Horizontal Scroll */}
      <div className="sm:hidden">
        <div className="flex space-x-3 overflow-x-auto pb-4 px-2 scrollbar-hide">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const colors = colorClasses[step.color as keyof typeof colorClasses];
            
            return (
              <div key={step.id} className="flex-shrink-0 flex flex-col items-center min-w-[70px] relative">
                <button
                  onClick={() => onStepClick(step.id)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-semibold transition-all duration-300 transform active:scale-95 touch-manipulation ${
                    currentStep > step.id
                      ? colors.completed
                      : currentStep === step.id
                      ? colors.active
                      : colors.inactive
                  }`}
                >
                  {currentStep > step.id ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </button>
                <div className="mt-2 text-center">
                  <h3 className={`text-xs font-semibold transition-colors duration-200 leading-tight ${
                    currentStep >= step.id ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                    {step.shortTitle}
                  </h3>
                </div>
                {/* Connection line for mobile */}
                {index < steps.length - 1 && (
                  <div className={`absolute top-5 left-12 w-6 h-0.5 transition-all duration-500 ${
                    currentStep > step.id ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tablet Step Indicator - Compact */}
      <div className="hidden sm:flex lg:hidden items-center justify-between relative px-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const colors = colorClasses[step.color as keyof typeof colorClasses];
          
          return (
            <div key={step.id} className="flex-1 relative">
              <div className="flex flex-col items-center">
                <button
                  onClick={() => onStepClick(step.id)}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center font-semibold transition-all duration-300 transform hover:scale-105 touch-manipulation ${
                    currentStep > step.id
                      ? colors.completed
                      : currentStep === step.id
                      ? colors.active
                      : colors.inactive
                  }`}
                >
                  {currentStep > step.id ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </button>
                <div className="mt-3 text-center max-w-24">
                  <h3 className={`text-sm font-semibold transition-colors duration-200 ${
                    currentStep >= step.id ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                    {step.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 leading-tight">{step.description}</p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`absolute top-6 left-1/2 w-full h-1 rounded-full transition-all duration-500 ${
                  currentStep > step.id ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gray-200'
                }`} style={{ transform: 'translateX(50%)', zIndex: -1 }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop Step Indicator - Full */}
      <div className="hidden lg:flex items-center justify-between relative">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const colors = colorClasses[step.color as keyof typeof colorClasses];
          
          return (
            <div key={step.id} className="flex-1 relative">
              <div className="flex flex-col items-center">
                <button
                  onClick={() => onStepClick(step.id)}
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center font-semibold transition-all duration-300 transform hover:scale-105 touch-manipulation ${
                    currentStep > step.id
                      ? colors.completed
                      : currentStep === step.id
                      ? colors.active
                      : colors.inactive
                  }`}
                >
                  {currentStep > step.id ? (
                    <Check className="w-6 h-6" />
                  ) : (
                    <Icon className="w-6 h-6" />
                  )}
                </button>
                <div className="mt-4 text-center max-w-32">
                  <h3 className={`text-sm font-semibold transition-colors duration-200 ${
                    currentStep >= step.id ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                    {step.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 leading-tight">{step.description}</p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`absolute top-7 left-1/2 w-full h-1 rounded-full transition-all duration-500 ${
                  currentStep > step.id ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gray-200'
                }`} style={{ transform: 'translateX(50%)', zIndex: -1 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};