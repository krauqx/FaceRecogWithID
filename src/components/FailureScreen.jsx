import React, { useEffect } from 'react';
import { XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * failurescreen component
 * 
 * displayed when any step of the verification process fails.
 * handles three failure types:
 *   - failed_id: student id not found in database (yellow warning)
 *   - failed_face: face doesn't match reference photo (red error)
 *   - failed_mismatch: id and face belong to different people (red error)
 * 
 * each failure type shows:
 * - appropriate icon (warning triangle or x circle)
 * - descriptive title and message
 * - context-specific suggestions for resolution
 * - the attempted student id (if available)
 * - retry button to restart the verification flow
 * 
 * @param {string} failureType - one of 'failed_id', 'failed_face', 'failed_mismatch'
 * @param {string} studentId - the student id that was attempted (may be null)
 * @param {Function} onRetry - callback to reset and retry the verification flow
 */
const FailureScreen = ({ failureType, studentId, onRetry }) => {
  // play failure sound effect on mount (silently fails if audio not available)
  useEffect(() => {
    const audio = new Audio('/failure.mp3');
    audio.play().catch(() => {});
  }, []);

  /** returns failure-specific ui content based on the failure type */
  const getFailureInfo = () => {
    switch (failureType) {
      case 'failed_id':
        return {
          icon: <AlertTriangle size={60} className="text-yellow-600" />,
          title: 'Student ID Not Found',
          message: `The student ID "${studentId}" is not registered in the system.`,
          suggestions: [
            'Verify the ID number is correct',
            'Ensure the ID card is valid and not expired',
            'Contact administration if you believe this is an error',
            'Check if the ID is properly registered in the database'
          ],
          color: 'yellow'
        };
      case 'failed_face':
        return {
          icon: <XCircle size={60} className="text-red-600" />,
          title: 'Face Verification Failed',
          message: 'The face does not match the registered student.',
          suggestions: [
            'Ensure you are the owner of the scanned ID card',
            'Remove glasses, masks, or face coverings',
            'Improve lighting conditions',
            'Position your face clearly in the camera frame',
            'Try again with better camera angle'
          ],
          color: 'red'
        };
      case 'failed_mismatch':
        return {
          icon: <XCircle size={60} className="text-red-600" />,
          title: 'Identity Mismatch',
          message: 'The ID card and face do not match the same person.',
          suggestions: [
            'Ensure you are using your own ID card',
            'Verify the ID card belongs to you',
            'Contact security if someone is using your ID',
            'Update your reference photo if it is outdated'
          ],
          color: 'red'
        };
      default:
        return {
          icon: <XCircle size={60} className="text-red-600" />,
          title: 'Verification Failed',
          message: 'Unable to complete verification process.',
          suggestions: ['Please try again'],
          color: 'red'
        };
    }
  };

  const info = getFailureInfo();
  const bgColor = info.color === 'yellow' ? 'from-yellow-50 to-orange-50' : 'from-red-50 to-pink-50';
  const borderColor = info.color === 'yellow' ? 'border-yellow-200' : 'border-red-200';

  return (
    <div className="bg-white rounded-xl shadow-2xl p-8 animate-fadeIn">
      <div className="text-center mb-6">
        <div className={`inline-flex items-center justify-center w-24 h-24 bg-${info.color}-100 rounded-full mb-4`}>
          {info.icon}
        </div>
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          {info.title}
        </h2>
        <p className="text-gray-600 text-lg">
          {info.message}
        </p>
      </div>

      {studentId && (
        <div className={`bg-gradient-to-br ${bgColor} rounded-lg p-4 mb-6 border-2 ${borderColor}`}>
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Attempted Student ID</p>
            <p className="text-2xl font-bold text-gray-800">{studentId}</p>
          </div>
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-5 mb-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <AlertTriangle size={16} />
          Suggestions to resolve:
        </h4>
        <ul className="space-y-2">
          {info.suggestions.map((suggestion, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="text-blue-600 font-bold mt-0.5">•</span>
              <span>{suggestion}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
        >
          <RefreshCw size={20} />
          Try Again
        </button>
      </div>

      <div className="mt-4 text-center">
        <p className="text-xs text-gray-500">
          If you continue to experience issues, please contact support
        </p>
      </div>
    </div>
  );
};

export default FailureScreen;
