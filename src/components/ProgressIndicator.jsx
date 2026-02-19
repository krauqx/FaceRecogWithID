import React from 'react';
import { Scan, User, CheckCircle2 } from 'lucide-react';

/**
 * progressindicator component
 * 
 * displays a vertical step indicator showing the verification progress.
 * three steps: scan id -> scan face -> verified
 * 
 * step statuses:
 *   - completed: green background, white icon (step is done)
 *   - active: green background with pulse animation (current step)
 *   - pending: gray background (not yet reached)
 *   - error: red background (any failed_* state)
 * 
 * connecting lines between steps fill green when the next step is active/completed.
 * 
 * @param {string} currentStep - current verification state from useverificationflow
 */
const ProgressIndicator = ({ currentStep }) => {
  // define the three verification steps with their icons
  const steps = [
    { id: 'scanning_id', label: 'Scan ID', icon: Scan },          // step 1
    { id: 'verifying_face', label: 'Scan Face', icon: User },     // step 2
    { id: 'success', label: 'Verified', icon: CheckCircle2 }      // step 3 (final)
  ];

  /**
   * determines the visual status of a step based on the current flow state
   * @param {string} stepId - the step to check
   * @returns {'completed'|'active'|'pending'|'error'} visual status
   */
  const getStepStatus = (stepId) => {
    const stepOrder = ['scanning_id', 'verifying_face', 'success'];
    const currentIndex = stepOrder.indexOf(currentStep);
    const stepIndex = stepOrder.indexOf(stepId);

    // any failure state turns all steps red
    if (currentStep.startsWith('failed')) {
      return 'error';
    }

    if (stepIndex < currentIndex) return 'completed';  // past step
    if (stepIndex === currentIndex) return 'active';    // current step
    return 'pending';                                    // future step
  };

  return (
    <div className="flex items-center justify-center gap-8 mb-8">
      <div className="flex flex-col items-center relative">
        {steps.map((step, index) => {
          const status = getStepStatus(step.id);
          const Icon = step.icon;
          
          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center relative z-10">
                <div
                  className={`
                    w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all duration-300
                    ${status === 'completed' ? 'bg-green-500 text-white' : ''}
                    ${status === 'active' ? 'bg-green-600 text-white animate-pulse' : ''}
                    ${status === 'pending' ? 'bg-gray-200 text-gray-400' : ''}
                    ${status === 'error' ? 'bg-red-500 text-white' : ''}
                  `}
                >
                  <Icon size={20} strokeWidth={2.5} />
                </div>
                <span
                  className={`
                    text-xs font-bold
                    ${status === 'completed' ? 'text-green-600' : ''}
                    ${status === 'active' ? 'text-green-600' : ''}
                    ${status === 'pending' ? 'text-gray-400' : ''}
                    ${status === 'error' ? 'text-red-600' : ''}
                  `}
                >
                  {step.label}
                </span>
              </div>

              {index < steps.length - 1 && (
                <div className="w-1 h-8 my-2 relative">
                  <div
                    className={`
                      absolute left-0 top-0 w-full rounded transition-all duration-500
                      ${getStepStatus(steps[index + 1].id) === 'completed' || 
                        getStepStatus(steps[index + 1].id) === 'active' 
                        ? 'bg-green-500' 
                        : 'bg-gray-200'}
                    `}
                    style={{
                      height: (getStepStatus(steps[index + 1].id) === 'completed' || 
                               getStepStatus(steps[index + 1].id) === 'active') ? '100%' : '0%'
                    }}
                  ></div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressIndicator;
