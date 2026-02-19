  import React, { useRef, useEffect } from 'react';
  import { User, CheckCircle2, XCircle, ArrowLeft, ArrowRight, ArrowLeftRight } from 'lucide-react';
  import useFaceVerification from '../hooks/useFaceVerification';
  import * as faceapi from '@vladmandic/face-api';
  

  /**
   * faceverifier component (step 2)
   * 
   * renders the face verification interface with:
   * - live video feed from front-facing camera (4:3 aspect ratio)
   * - canvas overlay for face-api roi (region of interest) visualization
   * - student info card showing detected student details
   * - real-time status messages and similarity score
   * - loading spinner while models initialize
   * - error display for camera/model failures
   * - tips section for best verification results
   * 
   * @param {string} studentId - the detected student id from step 1
   * @param {Object} studentData - full student record { name, department, year, faceImage, email }
   * @param {Function} onVerified - callback when face is verified (receives { similarity, confidence })
   * @param {Function} onFailed - callback when face verification fails
   */
  const FaceVerifier = ({ studentId, studentData, onVerified, onFailed }) => {
    const videoRef = useRef(null);   // reference to the <video> element for camera feed
    const canvasRef = useRef(null);  // reference to the <canvas> overlay for roi drawing

    const {
    isReady,
    error,
    status,
    faceDetected,
    similarityScore,
    isVerifying,
    detectionsRef,

    // for anti-spoofing
    yawScore,
    passedLeft,
    passedRight,
    livenessPassed
  } = useFaceVerification(videoRef, studentData.faceImage, onVerified, onFailed);
  const livenessProgress = (passedLeft ? 50 : 0) + (passedRight ? 50 : 0); // 0, 50, 100
  const yawClamped = Math.max(-100, Math.min(100, yawScore ?? 0));
  const yawPercent = ((yawClamped + 100) / 200) * 100; // 0..100

    /**
     * canvas drawing effect - renders face-api roi overlay
     * 
     * uses requestanimationframe for smooth 60fps drawing.
     * reads face detection data from detectionsref (shared ref from hook)
     * to avoid react state re-render overhead.
     * 
     * when a face is detected, draws face-api's built-in blue detection box
     * with confidence score around the detected face.
     */
    useEffect(() => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      if (!canvas || !video || !isReady) return;

      let animationId;

      const draw = () => {
        // wait for video to have valid dimensions
        if (!video.videoWidth || !video.videoHeight) {
          animationId = requestAnimationFrame(draw);
          return;
        }

        // match canvas to displayed video size
        const rect = video.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // read latest detections from shared ref (updated by usefaceverification hook)
        const currentDetections = detectionsRef.current;

        if (currentDetections && currentDetections.length > 0) {
          // use face-api's built-in drawing with native video dimensions
          const displaySize = { width: video.videoWidth, height: video.videoHeight };
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          // resize detections to match canvas and draw blue roi boxes
          const resizedDetections = faceapi.resizeResults(currentDetections, displaySize);
          faceapi.draw.drawDetections(canvas, resizedDetections);
        }

        animationId = requestAnimationFrame(draw);
      };

      draw();

      // cleanup: cancel animation frame on unmount
      return () => {
        if (animationId) {
          cancelAnimationFrame(animationId);
        }
      };
    }, [isReady]); // only depends on isReady - detections read from ref, not state

    return (
      <div className="bg-white rounded-xl shadow-2xl p-6">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <User className="text-green-600" size={28} />
              Step 2: Verify Face
            </h2>
            <span className="text-sm text-gray-500">2/2</span>
          </div>
          <p className="text-gray-600">
            Look at the camera to verify your identity
          </p>
        </div>

        <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-600 mb-1">Student ID</p>
              <p className="text-lg font-bold text-gray-800">{studentId}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Name</p>
              <p className="text-lg font-bold text-gray-800">{studentData.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Department</p>
              <p className="text-sm text-gray-700">{studentData.department}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Year</p>
              <p className="text-sm text-gray-700">{studentData.year}</p>
            </div>
          </div>
        </div>

        <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain"
          />
          
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
          {/*Liveness test*/}
          {isReady && !error && faceDetected && !livenessPassed && (
            <div className="absolute top-3 left-3 right-3">
              <div className="bg-black/60 backdrop-blur-sm rounded-lg p-3 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-white">
                    <ArrowLeftRight size={16} className="opacity-90" />
                    <span className="text-sm font-semibold">Liveness Check</span>
                  </div>
                  <span className="text-xs text-white/80">{livenessProgress}%</span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-green-400 rounded-full transition-all duration-200"
                    style={{ width: `${livenessProgress}%` }}
                  />
                </div>

                {/* Steps */}
                <div className="flex items-center justify-between text-xs text-white/90 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${passedRight ? 'bg-green-400' : 'bg-white/30'}`} />
                    <span>Turn Right</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${passedLeft ? 'bg-green-400' : 'bg-white/30'}`} />
                    <span>Turn Left</span>
                  </div>
                </div>

                {/* Yaw meter */}
                <div className="text-white/90 text-xs mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <ArrowRight size={14} /> Right
                  </span>
                  <span className="text-white/70">Yaw: {Math.round(yawClamped)}</span>
                  <span className="flex items-center gap-1">
                    Left <ArrowLeft size={14} />
                  </span>
                </div>

                <div className="relative h-2 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-white"
                    style={{ left: `${yawPercent}%`, transform: 'translateX(-50%)' }}
                  />
                </div>

                {/* Hint text */}
                <div className="mt-2 text-xs text-white/90">
                  {!passedRight && !passedLeft && (
                    <span>Turn your head <b>RIGHT</b> then <b>LEFT</b>.</span>
                  )}
                  {passedRight && !passedLeft && (
                    <span>Good! Now turn your head <b>LEFT</b>.</span>
                  )}
                  {!passedRight && passedLeft && (
                    <span>Good! Now turn your head <b>RIGHT</b>.</span>
                  )}
                </div>
              </div>
            </div>
          )}


          {!isReady && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
              <div className="text-center text-white">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
                <p className="text-lg">Loading face recognition...</p>
              </div>
            </div>
          )}

          <div className="absolute bottom-4 left-4 right-4">
            <div className="rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-white text-sm font-medium drop-shadow-lg">{status}</span>
                {similarityScore !== null && (
                  <span className="text-white text-sm font-bold drop-shadow-lg">
                    {(similarityScore * 100).toFixed(1)}%
                  </span>
                )}
              </div>
              
              {faceDetected && (
                <div className="mt-2 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-400 drop-shadow-lg" />
                  <span className="text-green-400 text-xs drop-shadow-lg">Face detected</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center gap-2 text-red-700">
              <XCircle size={20} />
              <span className="text-sm font-semibold">{error}</span>
            </div>
          </div>
        )}

        <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-start gap-3">
            <div className="text-green-600 mt-1">💡</div>
            <div className="text-sm text-gray-700">
              <p className="font-semibold mb-1">Tips for best results:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Look directly at the camera</li>
                <li>Ensure your face is well-lit</li>
                <li>Remove glasses or masks if possible</li>
                <li>Keep your face centered in the frame</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };

  export default FaceVerifier;
