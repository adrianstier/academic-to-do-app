'use client';

import { useState } from 'react';

interface OnboardingModalProps {
  onClose: () => void;
  onCreateTask: () => void;
}

const steps = [
  {
    title: 'Welcome to Agency Tasks!',
    description: 'Your simple task management tool for tracking team work. Let us show you around.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: 'Create Tasks',
    description: 'Click "New Task" to add items to your list. Set priority, due dates, and assign to team members.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    title: 'Track Progress',
    description: 'View your dashboard to see task stats at a glance. Filter by status, priority, or assignee.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

export default function OnboardingModal({ onClose, onCreateTask }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const isLastStep = currentStep === steps.length - 1;
  const step = steps[currentStep];

  const handleNext = () => {
    if (isLastStep) {
      onClose();
      onCreateTask();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-fadeIn overflow-hidden">
        {/* Header with icon */}
        <div className="bg-gradient-to-br from-[#003B73] to-[#0071CE] p-8 text-center">
          <div className="w-20 h-20 mx-auto bg-white/20 rounded-2xl flex items-center justify-center mb-4">
            {step.icon}
          </div>
          <h2 className="text-2xl font-bold text-white">{step.title}</h2>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-600 text-center text-lg mb-6">{step.description}</p>

          {/* Step indicators */}
          <div className="flex justify-center gap-2 mb-6">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  index === currentStep
                    ? 'bg-[#003B73] w-6'
                    : index < currentStep
                    ? 'bg-[#0071CE]'
                    : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSkip}
              className="flex-1 px-5 py-3 text-gray-600 hover:text-gray-800 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all font-medium"
            >
              Skip
            </button>
            <button
              onClick={handleNext}
              className="flex-1 px-5 py-3 bg-[#003B73] text-white rounded-xl hover:bg-[#002d59] transition-all font-semibold shadow-sm hover:shadow"
            >
              {isLastStep ? 'Create First Task' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
