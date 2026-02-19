import React, { useRef, useEffect, useState } from 'react';
import { Camera, Scan } from 'lucide-react';
import useIDScannerLogic from '../hooks/useIDScannerLogic';

/**
 * idscanner component (step 1)
 * 
 * renders the id card scanning interface with:
 * - live video feed from rear-facing camera (16:9 aspect ratio)
 * - canvas overlay with roi visualization:
 *   - when object detected: cyan bounding box with corner accents
 *   - when no object: dashed guide box with corner brackets and scan line animation
 * - real-time status messages
 * - loading spinner while models initialize
 * - error display for camera failures
 * - tips section for best scanning results
 * 
 * @param {Function} onIDDetected - callback when a valid student id is found
 */
const IDScanner = ({ onIDDetected }) => {
  const videoRef = useRef(null);      // reference to the <video> element for camera feed
  const canvasRef = useRef(null);     // reference to the <canvas> overlay for roi drawing
  const animationRef = useRef(null);  // requestanimationframe id for cleanup
  const scanLineY = useRef(0);        // current y position of the scanning line animation
  
  const {
    isReady,
    error,
    status,
    detections,
    scanProgress,
    startScanning
  } = useIDScannerLogic(videoRef, onIDDetected);

  // auto-start scanning when camera and models are ready
  useEffect(() => {
    if (isReady) {
      startScanning();
    }
  }, [isReady, startScanning]);

  /**
   * canvas drawing effect - renders roi overlay
   * 
   * two modes:
   * 1. object detected: draw cyan bounding box with corner accents around detected object
   * 2. no object: draw dashed guide box with corner brackets, scan line animation, and text hint
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (!canvas || !video || !isReady) return;

    const drawROI = () => {
      const ctx = canvas.getContext('2d');
      const rect = video.getBoundingClientRect();
      
      // match canvas to displayed video size
      canvas.width = rect.width;
      canvas.height = rect.height;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const isScanning = scanProgress > 0 && scanProgress < 100;
      
      // mode 1: draw bounding boxes around detected objects (coco-ssd results)
      if (detections && detections.length > 0) {
        const scaleX = rect.width / (video.videoWidth || 1);
        const scaleY = rect.height / (video.videoHeight || 1);
        
        detections.forEach((detection) => {
          // scale detection coordinates from native video to displayed size
          const [x, y, width, height] = detection.bbox;
          const dx = x * scaleX;
          const dy = y * scaleY;
          const dw = width * scaleX;
          const dh = height * scaleY;
          
          // draw cyan bounding box around detected object
          ctx.strokeStyle = '#00bcd4';
          ctx.lineWidth = 3;
          ctx.strokeRect(dx, dy, dw, dh);
          
          // draw corner accent brackets for visual emphasis
          const cornerLen = 20;
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          
          // top-left
          ctx.beginPath();
          ctx.moveTo(dx, dy + cornerLen);
          ctx.lineTo(dx, dy);
          ctx.lineTo(dx + cornerLen, dy);
          ctx.stroke();
          
          // top-right
          ctx.beginPath();
          ctx.moveTo(dx + dw - cornerLen, dy);
          ctx.lineTo(dx + dw, dy);
          ctx.lineTo(dx + dw, dy + cornerLen);
          ctx.stroke();
          
          // bottom-left
          ctx.beginPath();
          ctx.moveTo(dx, dy + dh - cornerLen);
          ctx.lineTo(dx, dy + dh);
          ctx.lineTo(dx + cornerLen, dy + dh);
          ctx.stroke();
          
          // bottom-right
          ctx.beginPath();
          ctx.moveTo(dx + dw - cornerLen, dy + dh);
          ctx.lineTo(dx + dw, dy + dh);
          ctx.lineTo(dx + dw, dy + dh - cornerLen);
          ctx.stroke();
        });
      } else {
        // mode 2: no detection - draw guide box for id card placement
        // guide box sized for landscape id card (85% width, 40% height)
        const guideWidth = canvas.width * 0.85;
        const guideHeight = canvas.height * 0.40;
        const guideX = (canvas.width - guideWidth) / 2;
        const guideY = (canvas.height - guideHeight) / 2;
        
        // dashed guide
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.strokeRect(guideX, guideY, guideWidth, guideHeight);
        ctx.setLineDash([]);
        
        // corner brackets
        const cornerLen = 30;
        ctx.strokeStyle = isScanning ? '#00bcd4' : 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 3;
        
        // top-left
        ctx.beginPath();
        ctx.moveTo(guideX, guideY + cornerLen);
        ctx.lineTo(guideX, guideY);
        ctx.lineTo(guideX + cornerLen, guideY);
        ctx.stroke();
        
        // top-right
        ctx.beginPath();
        ctx.moveTo(guideX + guideWidth - cornerLen, guideY);
        ctx.lineTo(guideX + guideWidth, guideY);
        ctx.lineTo(guideX + guideWidth, guideY + cornerLen);
        ctx.stroke();
        
        // bottom-left
        ctx.beginPath();
        ctx.moveTo(guideX, guideY + guideHeight - cornerLen);
        ctx.lineTo(guideX, guideY + guideHeight);
        ctx.lineTo(guideX + cornerLen, guideY + guideHeight);
        ctx.stroke();
        
        // bottom-right
        ctx.beginPath();
        ctx.moveTo(guideX + guideWidth - cornerLen, guideY + guideHeight);
        ctx.lineTo(guideX + guideWidth, guideY + guideHeight);
        ctx.lineTo(guideX + guideWidth, guideY + guideHeight - cornerLen);
        ctx.stroke();
        
        // animated scan line that moves vertically through the guide box
        if (isScanning) {
          scanLineY.current = (scanLineY.current + 3) % guideHeight; // move 3px per frame
          
          const gradient = ctx.createLinearGradient(guideX, 0, guideX + guideWidth, 0);
          gradient.addColorStop(0, 'transparent');
          gradient.addColorStop(0.2, '#00bcd4');
          gradient.addColorStop(0.8, '#00bcd4');
          gradient.addColorStop(1, 'transparent');
          
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(guideX + 5, guideY + scanLineY.current);
          ctx.lineTo(guideX + guideWidth - 5, guideY + scanLineY.current);
          ctx.stroke();
        }
        
        // text hint
        ctx.font = '16px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.textAlign = 'center';
        ctx.fillText('Position your ID here', canvas.width / 2, guideY - 15);
      }
      
      if (isScanning) {
        animationRef.current = requestAnimationFrame(drawROI);
      }
    };
    
    drawROI();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isReady, detections, scanProgress]);

  return (
    <div className="bg-white rounded-xl shadow-2xl p-6">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Scan className="text-blue-600" size={28} />
            Step 1: Scan Student ID
          </h2>
          <span className="text-sm text-gray-500">1/2</span>
        </div>
        <p className="text-gray-600">
          Position your student ID card in the camera view
        </p>
      </div>

      <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {!isReady && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-lg">Starting camera...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-900 bg-opacity-90">
            <div className="text-center text-white p-6">
              <Camera size={48} className="mx-auto mb-4" />
              <p className="text-lg font-semibold mb-2">Camera Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <div className="absolute bottom-4 left-4 right-4">
          <div className="rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-white text-sm font-medium drop-shadow-lg">{status}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start gap-3">
          <div className="text-sm text-gray-700">
            <p className="font-semibold mb-1">Tips for best results:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Hold ID card steady in the frame</li>
              <li>Ensure good lighting on the card</li>
              <li>Keep the card steady and in focus</li>
              <li>Position the student number clearly visible</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IDScanner;
