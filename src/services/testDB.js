// src/services/testDB.js

// In-memory cache synced from backend /api/students
const STUDENTS = {};

const digitsOnly = (s) => String(s ?? '').replace(/\D/g, '');

export const syncStudentsFromServer = async () => {
  const res = await fetch('/api/students');
  if (!res.ok) throw new Error('Failed to sync students from server');
  const data = await res.json();

  // Merge server DB into cache + normalize faceImages
  for (const [id, student] of Object.entries(data.students || {})) {
    const canonicalId = digitsOnly(id);
    const faceImages =
      Array.isArray(student.faceImages) && student.faceImages.length
        ? student.faceImages
        : student.faceImage
          ? [student.faceImage]
          : [];

    STUDENTS[canonicalId] = { ...student, id: canonicalId, faceImages };
  }
};

export const getStudentByID = (studentId) => {
  const canonicalId = digitsOnly(studentId);
  return STUDENTS[canonicalId] || null;
};

export const isValidStudentID = (studentId) => {
  const canonicalId = digitsOnly(studentId);
  return canonicalId in STUDENTS;
};

export const getAllValidStudentIDs = () => Object.keys(STUDENTS);

export const getFaceImagePaths = (studentId) => {
  const student = getStudentByID(studentId);
  return student?.faceImages?.length ? student.faceImages : student?.faceImage ? [student.faceImage] : [];
};

export default {
  syncStudentsFromServer,
  getStudentByID,
  isValidStudentID,
  getAllValidStudentIDs,
  getFaceImagePaths,
};