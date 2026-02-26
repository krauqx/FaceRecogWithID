import React, { useEffect } from 'react';
import { CheckCircle2, User, Calendar, Clock, Award } from 'lucide-react';

/**
 * successscreen component
 * 
 * displayed after successful face verification.
 * shows:
 * - animated success icon with bounce effect
 * - student photo, name, department, and year
 * - match score percentage and verification status
 * - attendance details (date and time of verification)
 * - reset button to start a new verification
 * 
 * plays success.mp3 audio on mount.
 * 
 * @param {Object} studentData - student record { id, name, department, year, faceImage }
 * @param {Object} verificationResult - { similarity, confidence, timestamp, studentId }
 * @param {Function} onReset - callback to reset the verification flow
 */
const SuccessScreen = ({ studentData, verificationResult, onReset }) => {
  // play success sound effect on mount (silently fails if audio not available)
  useEffect(() => {
    const audio = new Audio('/success.mp3');
    audio.play().catch(() => {});
  }, []);
  //writeintologfileherehrerheur
  useEffect(() => {
  fetch("/api/log-success", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "verification_success",
      studentData,
      verificationResult,
    }),
  }).catch(() => {});
}, [studentData, verificationResult]);

  /** formats iso timestamp to readable time (e.g., "02:30:45 pm") */
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  /** formats iso timestamp to readable date (e.g., "monday, february 9, 2026") */
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-2xl p-8 animate-fadeIn">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full mb-4 animate-bounce">
          <CheckCircle2 size={60} className="text-green-600" strokeWidth={2.5} />
        </div>
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          Verification Successful!
        </h2>
        <p className="text-gray-600">
          Identity confirmed and logged
        </p>
      </div>

      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 mb-6 border-2 border-green-200">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative">
            {studentData.faceImage ? (
              <img 
                src={studentData.faceImage} 
                alt={studentData.name}
                className="w-20 h-20 rounded-full object-cover border-4 border-green-600 shadow-lg"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center" style={{ display: studentData.faceImage ? 'none' : 'flex' }}>
              <User size={32} className="text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-green-600 rounded-full p-1">
              <CheckCircle2 size={16} className="text-white" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-800">{studentData.name}</h3>
            <p className="text-gray-600">{studentData.department}</p>
            <p className="text-xs text-green-600 font-semibold mt-1">✓ Face Matched</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-xs text-gray-600 mb-1">Student ID</p>
            <p className="text-lg font-bold text-gray-800">{studentData.id}</p>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-xs text-gray-600 mb-1">Year Level</p>
            <p className="text-lg font-bold text-gray-800">{studentData.year}</p>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-xs text-gray-600 mb-1">Match Score</p>
            <p className="text-lg font-bold text-green-600">
              {(verificationResult.similarity * 100).toFixed(1)}%
            </p>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-xs text-gray-600 mb-1">Status</p>
            <div className="flex items-center gap-1">
              <Award size={16} className="text-green-600" />
              <p className="text-sm font-bold text-green-600">Verified</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Attendance Details</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar size={16} />
              <span>Date</span>
            </div>
            <span className="font-medium text-gray-800">
              {formatDate(verificationResult.timestamp)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Clock size={16} />
              <span>Time</span>
            </div>
            <span className="font-medium text-gray-800">
              {formatTime(verificationResult.timestamp)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onReset}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default SuccessScreen;
