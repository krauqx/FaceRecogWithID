import { useState, useCallback } from 'react';
import { getStudentByID } from '../services/testDB';

/**
 * verification state machine
 * 
 * valid transitions:
 *   SCANNING_ID -> VERIFYING_FACE  (id found in database)
 *   SCANNING_ID -> FAILED_ID       (id not found in database)
 *   VERIFYING_FACE -> SUCCESS      (face matches reference)
 *   VERIFYING_FACE -> FAILED_FACE  (face doesn't match)
 *   VERIFYING_FACE -> FAILED_MISMATCH (id and face don't belong to same person)
 *   any FAILED_* -> SCANNING_ID    (reset/retry)
 *   SUCCESS -> SCANNING_ID         (reset for next student)
 */
const VERIFICATION_STATES = {
  SCANNING_ID: 'scanning_id',           // step 1: scanning student id card
  VERIFYING_FACE: 'verifying_face',     // step 2: verifying face against reference
  SUCCESS: 'success',                   // final: verification successful
  FAILED_ID: 'failed_id',              // error: student id not found in database
  FAILED_FACE: 'failed_face',          // error: face verification failed
  FAILED_MISMATCH: 'failed_mismatch'   // error: id and face don't match
};

/**
 * useverificationflow hook
 * 
 * manages the overall verification state machine that orchestrates
 * the two-step verification process: id scanning -> face verification.
 * 
 * @returns {Object} state and handlers for the verification flow
 */
const useVerificationFlow = () => {
  const [currentStep, setCurrentStep] = useState(VERIFICATION_STATES.SCANNING_ID);  // current state in the flow
  const [studentId, setStudentId] = useState(null);              // detected student id string
  const [studentData, setStudentData] = useState(null);          // full student record from database
  const [verificationResult, setVerificationResult] = useState(null); // face match results

  /**
   * called when idscanner successfully reads a student id
   * looks up the student in the database and transitions to face verification
   * @param {string} detectedId - the student id string read from the card
   */
  const handleIDDetected = useCallback((detectedId) => {
    console.log('ID Detected:', detectedId);
    
    // look up student in database
    const student = getStudentByID(detectedId);
    
    if (!student) {
      // student not found -> show failure screen
      console.error('Student not found in database');
      setCurrentStep(VERIFICATION_STATES.FAILED_ID);
      setStudentId(detectedId);
      return;
    }

    // student found -> proceed to face verification
    console.log('Student found:', student.name);
    setStudentId(detectedId);
    setStudentData(student);
    setCurrentStep(VERIFICATION_STATES.VERIFYING_FACE);
  }, []);

  /**
   * called when faceverifier confirms the face matches the reference
   * stores the verification result with timestamp and transitions to success
   * @param {Object} result - { similarity: number, confidence: number }
   */
  const handleFaceVerified = useCallback((result) => {
    console.log('Face verified:', result);
    setVerificationResult({
      ...result,
      timestamp: new Date().toISOString(),  // record verification time
      studentId: studentId
    });
    setCurrentStep(VERIFICATION_STATES.SUCCESS);
  }, [studentId]);

  /**
   * called when faceverifier fails to match the face
   * @param {string} reason - description of why verification failed
   */
  const handleFaceFailed = useCallback((reason) => {
    console.error('Face verification failed:', reason);
    setCurrentStep(VERIFICATION_STATES.FAILED_FACE);
  }, []);

  /** resets the entire verification flow back to step 1 (id scanning) */
  const reset = useCallback(() => {
    console.log('Resetting verification flow');
    setCurrentStep(VERIFICATION_STATES.SCANNING_ID);
    setStudentId(null);
    setStudentData(null);
    setVerificationResult(null);
  }, []);

  return {
    currentStep,
    studentId,
    studentData,
    verificationResult,
    handleIDDetected,
    handleFaceVerified,
    handleFaceFailed,
    reset
  };
};

export default useVerificationFlow;
