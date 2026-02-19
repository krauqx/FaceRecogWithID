# Face Recognition Verification System

A real-time, browser-based student identity verification system that combines **ID card scanning** (OCR) with **face recognition** for two-factor authentication.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Verification Flow](#verification-flow)
- [Key Algorithms](#key-algorithms)
- [Configuration](#configuration)
- [Setup & Installation](#setup--installation)
- [Usage](#usage)
- [Hardware Requirements](#hardware-requirements)
- [API Reference](#api-reference)

---

## Overview

This system verifies student identity through a two-step process:

1. **Step 1 - ID Card Scanning**: Uses the rear camera to detect and read a student ID card via object detection (COCO-SSD) and OCR (Tesseract.js). The detected ID is looked up in the student database.

2. **Step 2 - Face Verification**: Uses the front camera to capture the student's face and compare it against the reference photo stored in the database using face-api.js. Face similarity is calculated using **Euclidean Distance** on 128-dimensional face descriptors.

Upon successful verification, the system displays a success screen with attendance details and plays an audio confirmation.

---

## Architecture

```
main.jsx → App.jsx → FaceRecog.jsx (Main Orchestrator)
  │
  ├── ProgressIndicator          (Vertical step indicator: Scan ID → Scan Face → Verified)
  │
  ├── IDScanner                  (Step 1: ID Card Scanning UI)
  │   └── useIDScannerLogic      (COCO-SSD + Tesseract.js OCR)
  │
  ├── FaceVerifier               (Step 2: Face Verification UI)
  │   └── useFaceVerification    (face-api.js + Euclidean Distance)
  │
  ├── SuccessScreen              (Verification success + attendance log)
  │
  └── FailureScreen              (Error handling with retry)

State Machine (useVerificationFlow):
  SCANNING_ID → VERIFYING_FACE → SUCCESS
       ↓              ↓
   FAILED_ID     FAILED_FACE / FAILED_MISMATCH
       ↓              ↓
       └──── RESET ───┘
```

---

## Tech Stack

| Technology | Purpose |
|---|---|
| **React 18** | UI framework |
| **Vite** | Build tool & dev server |
| **TailwindCSS** | Utility-first CSS styling |
| **@vladmandic/face-api** | Face detection, landmarks, and recognition |
| **@tensorflow/tfjs** | TensorFlow.js runtime (WebGL backend) |
| **@tensorflow-models/coco-ssd** | Object detection for ID cards |
| **Tesseract.js** | OCR (Optical Character Recognition) |
| **Lucide React** | Icon library |
| **Web Speech API** | Voice announcement on verification |
| **Express.js** | Backend server for serving uploads |

---

## Project Structure

```
Face-Recognition/
├── public/
│   ├── models/                  # face-api.js model weights
│   │   ├── tiny_face_detector_model-*
│   │   ├── face_landmark_68_model-*
│   │   └── face_recognition_model-*
│   ├── uploads/                 # Student reference face photos
│   │   ├── mememe.jpg
│   │   └── jungkok.jpg
│   └── success.mp3             # Success sound effect
├── src/
│   ├── main.jsx                # App entry point
│   ├── app.jsx                 # Root component
│   ├── FaceRecog.jsx           # Main orchestrator component
│   ├── index.css               # TailwindCSS + custom animations
│   ├── components/
│   │   ├── IDScanner.jsx       # Step 1: ID scanning UI + canvas ROI overlay
│   │   ├── FaceVerifier.jsx    # Step 2: Face verification UI + face-api ROI
│   │   ├── ProgressIndicator.jsx # Vertical step progress indicator
│   │   ├── SuccessScreen.jsx   # Verification success screen
│   │   └── FailureScreen.jsx   # Verification failure screen
│   ├── hooks/
│   │   ├── useVerificationFlow.js  # State machine for verification steps
│   │   ├── useIDScannerLogic.js    # ID scanning logic (COCO-SSD + Tesseract)
│   │   └── useFaceVerification.js  # Face verification logic (face-api)
│   └── services/
│       └── testDB.js           # Mock student database
├── backend.js                  # Express server for file uploads
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

---

## Verification Flow

### Step 1: ID Card Scanning (`IDScanner` + `useIDScannerLogic`)

1. Rear camera initializes at **1280x720** resolution
2. **COCO-SSD** model detects objects in the video frame
3. If an object is detected, the frame is **cropped to its bounding box** (ROI)
4. The cropped image is **preprocessed** (grayscale + binary threshold)
5. **Tesseract.js** performs OCR with digit-only whitelist
6. OCR text is searched for valid student IDs using:
   - Exact substring match
   - 7-digit sliding window
   - First 7 digits fallback
7. If a valid ID is found, it's looked up in the student database
8. Scanning runs **indefinitely** at 1-second intervals until a match is found

### Step 2: Face Verification (`FaceVerifier` + `useFaceVerification`)

1. Front camera initializes at **640x480** resolution (4:3)
2. **face-api.js** models load: TinyFaceDetector, FaceLandmark68, FaceRecognition
3. Reference face descriptor is extracted from the student's stored photo
4. Live face detection runs every **1 second**:
   - Detects all faces in frame
   - Validates face quality (centered, proper size, confidence > 0.5)
   - Extracts 128-dimensional face descriptor
5. Face matching runs every **6 seconds** (throttled):
   - Calculates **Euclidean Distance** between live and reference descriptors
   - Converts to similarity score (0-1)
   - If similarity >= **0.58** threshold → **VERIFIED**
6. On success: plays audio announcement via Web Speech API

---

## Key Algorithms

### Face Similarity: Euclidean Distance

Face-api.js generates a **128-dimensional vector** (descriptor) for each detected face. To compare two faces:

```
distance = sqrt( sum( (a[i] - b[i])^2 ) )  for i = 0 to 127
similarity = max(0, 1 - distance)
```

**Typical ranges:**

| Distance | Similarity | Meaning |
|---|---|---|
| 0.0 - 0.3 | 70-100% | Same person (ideal conditions) |
| 0.3 - 0.5 | 50-70% | Same person (varying conditions) |
| 0.5 - 0.7 | 30-50% | Different people |
| 0.7+ | 0-30% | Very different faces |

### OCR Preprocessing

Images are preprocessed before OCR for better accuracy:

1. **Grayscale conversion**: `gray = R*0.299 + G*0.587 + B*0.114`
2. **Binary thresholding**: `pixel > 128 ? 255 : 0`

This creates high-contrast black/white images that Tesseract can read more accurately.

### OCR Character Correction

Common OCR misreads are corrected:
- `O/o` → `0`, `I/l/L` → `1`, `S/s/$` → `5`
- `Z/z` → `2`, `B/b` → `8`, `G/g` → `9`
- `A/a/@` → `4`, `T/t/+` → `7`

---

## Configuration

### Face Verification (`useFaceVerification.js`)

| Parameter | Value | Description |
|---|---|---|
| `MATCH_THRESHOLD` | `0.58` | Minimum similarity to verify (0-1) |
| `DETECTION_INTERVAL` | `1000` | Face detection frequency (ms) |
| `MATCHING_THROTTLE` | `6000` | Minimum time between match attempts (ms) |
| Camera Resolution | `640x480` | Front-facing, 4:3 aspect ratio |
| Face Detector | `TinyFaceDetector` | Input size: 160, score threshold: 0.5 |

### ID Scanner (`useIDScannerLogic.js`)

| Parameter | Value | Description |
|---|---|---|
| `SCAN_INTERVAL` | `1000` | Scan frequency (ms) |
| Max Attempts | Unlimited | Scans indefinitely until ID found |
| Camera Resolution | `1280x720` | Rear-facing, 16:9 aspect ratio |
| Object Detector | `COCO-SSD` | lite_mobilenet_v2, min confidence: 0.25 |
| OCR Engine | `Tesseract.js` | English, digit-only whitelist |

---

## Setup & Installation

### Prerequisites

- **Node.js** >= 16.x
- **npm** >= 8.x
- A device with **front and rear cameras** (or webcam)
- Modern browser with **WebGL** support (Chrome, Edge, Firefox)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd Face-Recognition

# Install dependencies
npm install

# Start the development server
npm run dev

# In a separate terminal, start the backend server
node backend.js
```

### Adding Students

1. Place the student's reference face photo in `/public/uploads/`
2. Add the student record to `src/services/testDB.js`:

```javascript
'STUDENT_ID': {
  id: 'STUDENT_ID',
  name: 'Student Name',
  department: 'Department',
  year: 'Year Level',
  faceImage: '/uploads/photo.jpg',
  email: 'student@university.edu'
}
```

---

## Usage

1. **Open the application** in a browser (default: `http://localhost:5173`)
2. **Step 1**: Hold your student ID card in front of the rear camera
   - Wait for the system to detect and read the ID number
   - The ROI (cyan box) will appear around the detected card
3. **Step 2**: Look at the front camera for face verification
   - The face-api ROI box will appear around your face
   - Wait for the similarity score to reach the threshold
4. **Success**: View your verification details and attendance log
5. **Click Reset** to verify another student

---


---

## API Reference

### Hooks

#### `useFaceVerification(videoRef, referenceFaceImage, onVerified, onFailed)`

Returns: `{ isReady, error, status, faceDetected, similarityScore, isVerifying, detectionsRef }`

#### `useIDScannerLogic(videoRef, onIDDetected)`

Returns: `{ isReady, error, status, detections, startScanning, stopScanning }`

#### `useVerificationFlow()`

Returns: `{ currentStep, studentId, studentData, verificationResult, handleIDDetected, handleFaceVerified, handleFaceFailed, reset }`

### Database Functions (`testDB.js`)

| Function | Description |
|---|---|
| `getStudentByID(id)` | Get student record by ID |
| `isValidStudentID(id)` | Check if ID exists |
| `getAllValidStudentIDs()` | Get all registered IDs |
| `getFaceImagePath(id)` | Get face photo path |
| `addStudent(data)` | Add new student |
