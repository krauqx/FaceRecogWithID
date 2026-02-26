import { useState, useEffect, useCallback, useRef } from 'react';
import * as faceapi from '@vladmandic/face-api';

const useFaceVerification = (videoRef, referenceFaceImages, onVerified, onFailed) => {
  // UI state
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('Initializing...');
  const [faceDetected, setFaceDetected] = useState(false);
  const [similarityScore, setSimilarityScore] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Liveness UI (state for UI)
  const [yawScore, setYawScore] = useState(0);
  const [passedLeft, setPassedLeft] = useState(false);
  const [passedRight, setPassedRight] = useState(false);
  const [livenessPassed, setLivenessPassed] = useState(false);

  // Liveness refs (used for logic; prevents effect restart loops)
  const passedLeftRef = useRef(false);
  const passedRightRef = useRef(false);
  const livenessPassedRef = useRef(false);

  // For overlay
  const detectionsRef = useRef([]);

  // Internal refs
  const modelsLoadedRef = useRef(false);
  const detectionIntervalRef = useRef(null);
  const streamRef = useRef(null);

  const referenceDescriptorsRef = useRef([]); // Float32Array[]
  const failedAttemptsRef = useRef(0);
  const hasVerifiedRef = useRef(false);
  const hasFailedRef = useRef(false);

  // Multi-frame batch
  const batchStartRef = useRef(null);
  const batchDistancesRef = useRef([]); // number[]

  // --------------------
  // TUNABLE SETTINGS
  // --------------------
  const DISTANCE_THRESHOLD = 0.60;
  const DETECTION_INTERVAL = 250;

  const MAX_SAMPLES = 12;
  const REQUIRED_GOOD_FRAMES = 6;
  const BATCH_TIMEOUT_MS = 2200;

  const MAX_FAILED_ATTEMPTS = 5;

  const TINY_INPUT_SIZE = 320;
  const SCORE_THRESHOLD = 0.5;

  const YAW_THRESHOLD = 70;

  // --------------------
  // Helpers
  // --------------------
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const distanceToUiSimilarity = (d) => clamp01(1 - d);

  const speak = useCallback((text) => {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0;
    u.pitch = 1.0;
    u.volume = 0.8;
    window.speechSynthesis.speak(u);
  }, []);

  const asArray = useCallback(
    (x) => (Array.isArray(x) ? x.filter(Boolean) : x ? [x] : []),
    []
  );

  const initCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;

        await new Promise((resolve) => {
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            resolve();
          };
        });
      }
      return true;
    } catch (err) {
      console.error('Camera error:', err);
      setError('Camera access denied');
      return false;
    }
  }, [videoRef]);

  const loadModels = useCallback(async () => {
    if (modelsLoadedRef.current) return true;
    try {
      setStatus('Loading face recognition models...');
      const modelPath = `${window.location.origin}/models`;

      if (faceapi?.tf?.ready) await faceapi.tf.ready();

      await faceapi.nets.tinyFaceDetector.loadFromUri(modelPath);
      await faceapi.nets.faceLandmark68Net.loadFromUri(modelPath);
      await faceapi.nets.faceRecognitionNet.loadFromUri(modelPath);

      modelsLoadedRef.current = true;
      return true;
    } catch (err) {
      console.error('Model loading error:', err);
      setError('Failed to load face recognition models');
      return false;
    }
  }, []);

  // ✅ Memoized detectors (stops startFaceDetection from changing every render)
  const detectAll = useCallback(async (input) => {
    return faceapi
      .detectAllFaces(
        input,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: TINY_INPUT_SIZE,
          scoreThreshold: SCORE_THRESHOLD,
        })
      )
      .withFaceLandmarks()
      .withFaceDescriptors();
  }, [TINY_INPUT_SIZE, SCORE_THRESHOLD]);

  const detectSingle = useCallback(async (imgEl) => {
    return faceapi
      .detectSingleFace(
        imgEl,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: TINY_INPUT_SIZE,
          scoreThreshold: SCORE_THRESHOLD,
        })
      )
      .withFaceLandmarks()
      .withFaceDescriptor();
  }, [TINY_INPUT_SIZE, SCORE_THRESHOLD]);

  const estimateYawScore = useCallback((landmarks) => {
    if (!landmarks) return 0;
    const pts = landmarks.positions;
    const nose = pts[30];
    const leftEye = pts[36];
    const rightEye = pts[45];

    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    const dLeft = dist(nose, leftEye);
    const dRight = dist(nose, rightEye);
    const eyeDist = dist(leftEye, rightEye);
    if (eyeDist < 1) return 0;

    const ratio = (dLeft - dRight) / eyeDist;
    const gain = 250;
    return Math.max(-100, Math.min(100, ratio * gain));
  }, []);

  const loadReferenceDescriptors = useCallback(async () => {
    try {
      setStatus('Loading reference face(s)...');
      const imgs = asArray(referenceFaceImages);
      if (!imgs.length) throw new Error('No reference images provided');

      const descs = [];
      for (const src of imgs) {
        const imgEl = await new Promise((resolve, reject) => {
          const image = new Image();
          image.crossOrigin = 'anonymous';
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error(`Failed to load: ${src}`));
          image.src = `${src}?t=${Date.now()}`;
        });

        const det = await detectSingle(imgEl);
        if (!det) continue;
        descs.push(det.descriptor);
      }

      if (!descs.length) throw new Error('No face found in any reference image');
      referenceDescriptorsRef.current = descs;
      return true;
    } catch (err) {
      console.error(err);
      setError('Failed to load reference face image(s)');
      return false;
    }
  }, [referenceFaceImages, asArray, detectSingle]);

  const minDistanceToRefs = useCallback((liveDescriptor) => {
    let minDist = Number.POSITIVE_INFINITY;
    for (const ref of referenceDescriptorsRef.current) {
      const d = faceapi.euclideanDistance(liveDescriptor, ref);
      if (d < minDist) minDist = d;
    }
    return minDist;
  }, []);

  const resetBatch = useCallback(() => {
    batchStartRef.current = null;
    batchDistancesRef.current = [];
    setIsVerifying(false);
  }, []);

  const decideBatch = useCallback(() => {
    const arr = batchDistancesRef.current.slice().sort((a, b) => a - b);
    if (!arr.length) return { pass: false, median: null, good: 0, total: 0 };

    const median = arr[Math.floor(arr.length / 2)];
    const good = arr.filter((d) => d <= DISTANCE_THRESHOLD).length;

    return {
      pass: median <= DISTANCE_THRESHOLD && good >= REQUIRED_GOOD_FRAMES,
      median,
      good,
      total: arr.length,
    };
  }, [DISTANCE_THRESHOLD, REQUIRED_GOOD_FRAMES]);

  const stop = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startFaceDetection = useCallback(() => {
    if (!videoRef.current || !referenceDescriptorsRef.current.length) return;

    // ✅ Prevent starting multiple intervals
    if (detectionIntervalRef.current) return;

    hasVerifiedRef.current = false;
    hasFailedRef.current = false;
    failedAttemptsRef.current = 0;

    // Reset liveness state + refs
    passedLeftRef.current = false;
    passedRightRef.current = false;
    livenessPassedRef.current = false;

    setPassedLeft(false);
    setPassedRight(false);
    setLivenessPassed(false);
    setYawScore(0);

    resetBatch();
    setStatus('Looking for face...');

    detectionIntervalRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (!video || hasVerifiedRef.current || hasFailedRef.current) return;

      try {
        const detections = await detectAll(video);
        detectionsRef.current = detections;

        if (detections.length === 0) {
          setFaceDetected(false);
          setSimilarityScore(null);
          setStatus('Please look at the camera');
          resetBatch();
          return;
        }

        if (detections.length > 1) {
          setFaceDetected(false);
          setSimilarityScore(null);
          setStatus('Multiple faces detected — one person only');
          resetBatch();
          return;
        }

        const det = detections[0];
        setFaceDetected(true);

        // Liveness first
        const yaw = estimateYawScore(det.landmarks);
        setYawScore(yaw);

        if (!livenessPassedRef.current) {
          if (yaw >= YAW_THRESHOLD && !passedLeftRef.current) {
            passedLeftRef.current = true;
            setPassedLeft(true);
          }
          if (yaw <= -YAW_THRESHOLD && !passedRightRef.current) {
            passedRightRef.current = true;
            setPassedRight(true);
          }

          const leftOk = passedLeftRef.current || yaw >= YAW_THRESHOLD;
          const rightOk = passedRightRef.current || yaw <= -YAW_THRESHOLD;

          if (leftOk && rightOk) {
            livenessPassedRef.current = true;
            setLivenessPassed(true);
            setStatus('Liveness OK. Hold still...');
          } else {
            setStatus('Liveness: turn RIGHT then LEFT');
          }

          setSimilarityScore(null);
          resetBatch();
          return;
        }

        // Begin / continue multi-frame batch
        const now = Date.now();
        if (!batchStartRef.current) {
          batchStartRef.current = now;
          batchDistancesRef.current = [];
          setIsVerifying(true);
          setStatus('Verifying... hold still');
        }

        const dist = minDistanceToRefs(det.descriptor);
        const uiSim = distanceToUiSimilarity(dist);
        setSimilarityScore(uiSim);

        if (Number.isFinite(dist) && dist > 0 && dist < 2.0) {
          batchDistancesRef.current.push(dist);
        }

        const enough = batchDistancesRef.current.length >= MAX_SAMPLES;
        const timeout = now - batchStartRef.current >= BATCH_TIMEOUT_MS;

        if (enough || timeout) {
          const result = decideBatch();
          resetBatch();

          if (result.pass) {
            hasVerifiedRef.current = true;
            setStatus('Verified ✅');
            speak('Verification Successful');
            onVerified?.({
              similarity: distanceToUiSimilarity(result.median),
              confidence: det.detection.score,
            });
            return;
          }

          failedAttemptsRef.current += 1;
          const left = MAX_FAILED_ATTEMPTS - failedAttemptsRef.current;

          if (failedAttemptsRef.current >= MAX_FAILED_ATTEMPTS) {
            hasFailedRef.current = true;
            setStatus('Verification failed');
            speak('Verification Failed. Face does not match.');
            onFailed?.('Face verification failed: exceeded max attempts');
            return;
          }

          setStatus(`Not a match yet — try again (${Math.max(0, left)} left)`);
        }
      } catch (e) {
        console.error('Detection loop error:', e);
      }
    }, DETECTION_INTERVAL);
  }, [
    videoRef,
    detectAll,
    estimateYawScore,
    minDistanceToRefs,
    decideBatch,
    resetBatch,
    onVerified,
    onFailed,
    speak,
    DETECTION_INTERVAL,
    MAX_SAMPLES,
    BATCH_TIMEOUT_MS,
    MAX_FAILED_ATTEMPTS,
    YAW_THRESHOLD,
  ]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const camOk = await initCamera();
      if (!camOk || !mounted) return;

      const modelsOk = await loadModels();
      if (!modelsOk || !mounted) return;

      const refOk = await loadReferenceDescriptors();
      if (!refOk || !mounted) return;

      setIsReady(true);
      setStatus('Ready - Look at camera');
      startFaceDetection();
    })();

    return () => {
      mounted = false;
      stop();
    };
  }, [initCamera, loadModels, loadReferenceDescriptors, startFaceDetection, stop]);

  return {
    isReady,
    error,
    status,
    faceDetected,
    similarityScore,
    isVerifying,
    detectionsRef,

    // liveness UI
    yawScore,
    passedLeft,
    passedRight,
    livenessPassed,
  };
};

export default useFaceVerification;