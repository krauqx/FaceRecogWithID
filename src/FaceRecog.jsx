import React, { useState } from 'react';
import IDScanner from './components/IDScanner';
import FaceVerifier from './components/FaceVerifier';
import SuccessScreen from './components/SuccessScreen';
import FailureScreen from './components/FailureScreen';
import ProgressIndicator from './components/ProgressIndicator';
import useVerificationFlow from './hooks/useVerificationFlow';

/**
 * verificationapp - main orchestrator component
 * 
 * root component that manages the entire verification flow.
 * uses the useverificationflow hook as a state machine to determine
 * which step/screen to render.
 * 
 * layout: horizontal flex with progressindicator on the left
 * and the active step component on the right (max-w-2xl).
 * 
 * flow:
 *   1. scanning_id     -> idscanner component
 *   2. verifying_face   -> faceverifier component
 *   3. success          -> successscreen component
 *   4. failed_*         -> failurescreen component (with retry)
 */
const VerificationApp = () => {
  // state machine hook - manages step transitions and data flow
  const {
    currentStep,          // current verification state (scanning_id, verifying_face, success, failed_*)
    studentId,            // detected student id string
    studentData,          // full student record from database
    verificationResult,   // face match results { similarity, confidence, timestamp }
    handleIDDetected,     // callback: id scanned -> look up student -> next step
    handleFaceVerified,   // callback: face matched -> success screen
    handleFaceFailed,     // callback: face failed -> failure screen
    reset                 // callback: reset everything to step 1
  } = useVerificationFlow();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center gap-8">
          <ProgressIndicator currentStep={currentStep} />
          
          <div className="flex-1 max-w-2xl">
            {currentStep === 'scanning_id' && (
              <IDScanner onIDDetected={handleIDDetected} />
            )}

            {currentStep === 'verifying_face' && studentData && (
              <FaceVerifier
                studentId={studentId}
                studentData={studentData}
                onVerified={handleFaceVerified}
                onFailed={handleFaceFailed}
              />
            )}

            {currentStep === 'success' && verificationResult && (
              <SuccessScreen
                studentData={studentData}
                verificationResult={verificationResult}
                onReset={reset}
              />
            )}

            {(currentStep === 'failed_id' || 
              currentStep === 'failed_face' || 
              currentStep === 'failed_mismatch') && (
              <FailureScreen
                failureType={currentStep}
                studentId={studentId}
                onRetry={reset}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerificationApp;
