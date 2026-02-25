import { useState, useEffect, useCallback, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import Tesseract from 'tesseract.js';
import { getAllValidStudentIDs, syncStudentsFromServer } from '../services/testDB';

/**
 * useidscannerlogic hook
 * 
 * custom react hook that handles real-time student id card scanning
 * using coco-ssd for object detection and tesseract.js for ocr.
 * 
 * flow:
 * 1. initialize rear-facing camera (1280x720)
 * 2. load coco-ssd model (object detection) and tesseract ocr worker
 * 3. periodically scan video frames for objects (id cards)
 * 4. if an object is detected, crop to its bounding box (roi) for focused ocr
 * 5. run ocr on the cropped region with digit-only whitelist
 * 6. clean ocr text and search for valid student ids
 * 7. if a valid id is found, trigger oniddetected callback
 * 
 * @param {React.RefObject} videoRef - reference to the html video element
 * @param {Function} onIDDetected - callback when a valid student id is found (receives studentid string)
 * @returns {Object} hook state: { isReady, error, status, detections, startScanning, stopScanning }
 */
const useIDScannerLogic = (videoRef, onIDDetected) => {
  // --- ui state ---
  const [isReady, setIsReady] = useState(false);       // true when camera + models are loaded
  const [error, setError] = useState(null);             // error message string if initialization fails
  const [status, setStatus] = useState('Initializing...');  // status text displayed to the user
  const [detections, setDetections] = useState([]);     // coco-ssd detection results for roi canvas drawing
  
  // --- internal refs ---
  const modelRef = useRef(null);           // coco-ssd model instance
  const ocrWorkerRef = useRef(null);       // tesseract.js ocr worker instance
  const scanIntervalRef = useRef(null);    // setinterval id for periodic scanning
  const isProcessingRef = useRef(false);   // prevents overlapping scan operations
  const scanCountRef = useRef(0);          // number of scan attempts (unlimited)
  const streamRef = useRef(null);          // mediastream for camera cleanup

  // --- configuration ---
  const SCAN_INTERVAL = 500;  // how often to scan for id cards (ms)

  /**
   * initializes the rear-facing camera at 1280x720 resolution
   * uses 'environment' facing mode for scanning physical id cards
   * @returns {boolean} true if camera initialized successfully
   */
  const initCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',    // rear camera for scanning id cards
          width: { ideal: 1280 },       // hd resolution for better ocr accuracy
          height: { ideal: 720 } 
        }
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
      setError('Camera access denied. Please enable camera permissions.');
      return false;
    }
  }, [videoRef]);

  /**
   * loads ai models:
   *   1. tensorflow.js with webgl backend for gpu acceleration
   *   2. coco-ssd (lite_mobilenet_v2) for object detection
   *   3. tesseract.js ocr worker configured for digit-only recognition
   * @returns {boolean} true if all models loaded successfully
   */
  const initModels = useCallback(async () => {
    try {
      setStatus('Loading AI models...');
      
      // initialize tensorflow.js with webgl backend for gpu acceleration
      await tf.ready();
      await tf.setBackend('webgl');
      
      // load coco-ssd object detection model (lightweight mobilenet variant)
      modelRef.current = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      
      // initialize tesseract ocr worker for english text recognition
      ocrWorkerRef.current = await Tesseract.createWorker('eng', 1, {
        logger: () => {}  // suppress verbose logging
      });
      
      // configure ocr for digit-only recognition (student ids are numeric)
      await ocrWorkerRef.current.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,  // treat image as single text block
        tessedit_char_whitelist: '0123456789',               // only recognize digits
      });

      console.log('Models loaded');
      return true;
    } catch (err) {
      console.error('Model loading error:', err);
      setError('Failed to load AI models');
      return false;
    }
  }, []);

  /**
   * cleans ocr text by replacing commonly misread characters with their digit equivalents
   * ocr engines often confuse letters with similar-looking digits:
   *   O/o -> 0, I/l/L -> 1, S/s/$ -> 5, Z/z -> 2, B/b -> 8, G/g -> 9, A/a/@ -> 4, T/t/+ -> 7
   * 
   * @param {string} text - raw ocr text output
   * @returns {string} cleaned string containing only digits
   */
  const cleanOcrText = (text) => {
    return text
      .replace(/[Oo]/g, '0')       // o looks like 0
      .replace(/[IlL|!]/g, '1')    // i, l, L look like 1
      .replace(/[Ss\$]/g, '5')     // s looks like 5
      .replace(/[Zz]/g, '2')       // z looks like 2
      .replace(/[Bb]/g, '8')       // b looks like 8
      .replace(/[Gg&]/g, '9')      // g looks like 9
      .replace(/[Aa@]/g, '4')      // a looks like 4
      .replace(/[Tt\+]/g, '7')     // t looks like 7
      .replace(/[^0-9]/g, '');     // remove any remaining non-digit characters
  };

  /**
   * searches ocr text for a valid student id from the database
   * 
   * strategy (in order of priority):
   *   1. exact match: check if any valid id appears as substring in the digit string
   *   2. sliding window: try all 7-digit substrings against valid ids
   *   3. first 7 digits: check if the first 7 digits match a valid id
   * 
   * @param {string} text - raw ocr text to search
   * @returns {string|null} matched student id or null if not found
   */
  const findValidStudentId = (text) => {
    const validIds = getAllValidStudentIDs();
    
    // strip everything except digits
    const digitsOnly = text.replace(/\D/g, '');
    
    console.log('All digits found:', digitsOnly, `(${digitsOnly.length} digits)`);
    
    // strategy 1: check if any valid id exists as substring in the digit string
    for (const validId of validIds) {
      if (digitsOnly.includes(validId)) {
        console.log('FOUND EXACT MATCH:', validId);
        return validId;
      }
    }
    
    // strategy 2: sliding window approach for 7-digit ids
    if (digitsOnly.length >= 7) {
      // try every possible 7-digit window
      for (let i = 0; i <= digitsOnly.length - 7; i++) {
        const candidate = digitsOnly.substring(i, i + 7);
        if (validIds.includes(candidate)) {
          console.log('FOUND IN WINDOW:', candidate);
          return candidate;
        }
      }
      
      // strategy 3: try the first 7 digits as a last resort
      const firstSeven = digitsOnly.substring(0, 7);
      console.log('Checking first 7 digits:', firstSeven);
      if (validIds.includes(firstSeven)) {
        console.log('MATCHED FIRST 7:', firstSeven);
        return firstSeven;
      }
    }
    
    console.log('No valid ID found in:', digitsOnly);
    return null;
  };

  /**
   * captures the entire video frame as a canvas for ocr processing
   * used as fallback when no object is detected by coco-ssd
   * 
   * @param {HTMLVideoElement} video - video element to capture from
   * @returns {HTMLCanvasElement} preprocessed canvas ready for ocr
   */
  const captureFullFrame = (video) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // apply grayscale + binary threshold for better ocr accuracy
    preprocessImage(ctx, canvas.width, canvas.height);
    
    return canvas;
  };

  /**
   * preprocesses an image for better ocr accuracy
   * applies grayscale conversion using luminance formula,
   * then binary thresholding to create high-contrast black/white image
   * 
   * luminance formula: gray = R*0.299 + G*0.587 + B*0.114
   * binary threshold: pixel > 128 = white (255), else black (0)
   * 
   * @param {CanvasRenderingContext2D} ctx - canvas context with image data
   * @param {number} width - image width in pixels
   * @param {number} height - image height in pixels
   */
  const preprocessImage = (ctx, width, height) => {
    try {
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      
      // convert each pixel to grayscale then apply binary threshold
      for (let i = 0; i < data.length; i += 4) {
        // weighted grayscale (human eye sensitivity: green > red > blue)
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        
        // binary threshold: creates sharp black/white image for ocr
        const threshold = 128;
        const value = gray > threshold ? 255 : 0;
        
        data[i] = value;       // r
        data[i + 1] = value;   // g
        data[i + 2] = value;   // b
        // alpha (data[i+3]) remains unchanged
      }
      
      ctx.putImageData(imageData, 0, 0);
    } catch (e) {
      console.error('Preprocessing error:', e);
    }
  };

  /**
   * scans a single video frame for student id
   * 
   * process:
   * 1. run coco-ssd object detection on the video frame
   * 2. if object detected, crop to its bounding box (roi) for focused ocr
   * 3. if no object, use full frame as fallback
   * 4. preprocess the image (grayscale + binary threshold)
   * 5. run tesseract ocr on the preprocessed image
   * 6. search ocr text for valid student ids
   * 7. if found, stop scanning and trigger callback
   */
  const scanFrame = useCallback(async () => {
    // guard: skip if already processing, or dependencies not ready
    if (isProcessingRef.current || !videoRef.current || !modelRef.current || !ocrWorkerRef.current) {
      return;
    }

    const video = videoRef.current;
    if (video.readyState < 2) return; // video not ready yet

    isProcessingRef.current = true;   // lock to prevent overlapping scans
    setStatus('Scanning for ID card...');

    try {
      // step 1: run coco-ssd object detection (max 1 detection, min 25% confidence)
      const predictions = await modelRef.current.detect(video, 1, 0.25);
      setDetections(predictions); // update state for roi canvas visualization

      let ocrCanvas;
      
      // step 2: determine ocr region - use detected object roi or full frame
      if (predictions.length > 0 && predictions[0].class === 'person') {
        
        const detection = predictions[0];
        const [x, y, width, height] = detection.bbox;
        
        
        ocrCanvas = document.createElement('canvas');
        const ctx = ocrCanvas.getContext('2d');
        
        ocrCanvas.width = width;
        ocrCanvas.height = height;
        
  
        ctx.drawImage(
          video,
          x, y, width, height, 
          0, 0, width, height  
        );
        
       
        preprocessImage(ctx, width, height);
        
        console.log('Using detected ID region:', { x, y, width, height });
      } else {
        
        ocrCanvas = captureFullFrame(video);
        console.log('No ID detected, using full frame');
      }
      
      // step 3: run tesseract ocr on the preprocessed image
      const { data } = await ocrWorkerRef.current.recognize(ocrCanvas);
      const rawText = data.text;

      console.log('═══════════════════════════════════');
      console.log('RAW OCR TEXT:');
      console.log(rawText);
      console.log('═══════════════════════════════════');

      // step 4: search ocr text for valid student ids
      const studentId = findValidStudentId(rawText);

      if (studentId) {
        // valid id found - stop scanning and notify parent
        console.log('Found student ID:', studentId);
        stopScanning();
        setStatus('ID detected!');
        onIDDetected(studentId);
        return;
      }

      // no valid id found - continue scanning (unlimited attempts)
      scanCountRef.current++;
      setStatus('Scanning for student ID...');

    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      isProcessingRef.current = false;
    }
  }, [videoRef, onIDDetected]);

  /** starts the periodic id scanning loop - runs immediately then every SCAN_INTERVAL ms */
  const startScanning = useCallback(() => {
    console.log('Starting ID scan...');
    setStatus('Scanning for student ID...');
    scanCountRef.current = 0;
    isProcessingRef.current = false;

    scanFrame();  // run first scan immediately
    scanIntervalRef.current = setInterval(scanFrame, SCAN_INTERVAL);
  }, [scanFrame]);

  /** stops the scanning interval and resets processing lock */
  const stopScanning = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    isProcessingRef.current = false;
  }, []);

  /**
   * initialization effect - runs once on mount
   * sequential setup: camera -> ai models -> ready
   * cleanup: stops scanning, releases camera, terminates ocr worker, clears model
   */
  useEffect(() => {
    let isMounted = true; // prevents state updates after unmount

    const init = async () => {
      // step 1: initialize rear camera
      const cameraOk = await initCamera();
      if (!cameraOk || !isMounted) return;

      // step 2: load coco-ssd + tesseract models
      const modelsOk = await initModels();
      if (!modelsOk || !isMounted) return;

      await syncStudentsFromServer();

      // step 3: all ready
      setIsReady(true);
      setStatus('Ready to scan');
    };

    init();

    // cleanup on unmount
    return () => {
      isMounted = false;
      stopScanning();
      
      // release camera stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // terminate tesseract ocr worker
      if (ocrWorkerRef.current) {
        ocrWorkerRef.current.terminate();
      }
      
      // clear coco-ssd model reference
      if (modelRef.current) {
        modelRef.current = null;
      }
    };
  }, [initCamera, initModels, stopScanning]);

  // expose state and controls to the consuming component (idscanner)
  return {
    isReady,        // boolean: camera + models initialized
    error,          // string: error message or null
    status,         // string: current status text for ui
    detections,     // array: coco-ssd detection results for roi canvas drawing
    startScanning,  // function: start the scanning loop
    stopScanning    // function: stop the scanning loop
  };
};

export default useIDScannerLogic;
