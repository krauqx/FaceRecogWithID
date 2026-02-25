/**
 * student database (mock/test)
 * 
 * in-memory student records used for id verification.
 * each student has:
 *   - id: unique student id number (string, used as key)
 *   - name: full name
 *   - department: academic department
 *   - year: year level
 *   - faceImage: path to reference face photo (stored in /public/uploads/)
 *   - email: student email address
 * 
 * in production, this would be replaced with a real database (e.g., mongodb, postgresql).
 */
const STUDENTS = {
  '2002547': {
    id: '20002547',
    name: 'John Paul',
    department: 'CCICT',
    year: '4th year',
    faceImage: '/uploads/mememe.jpg',
    email: 'john.doe@university.edu'
  },
  '2201547': {
    id: '2201547',
    name: 'Kevin Durant',
    department: 'Engineering',
    year: 'Senior',
    faceImage: '/uploads/jungkok.jpg',
    email: 'kevin@university.edu'
  }
};

export const syncStudentsFromServer = async () => {
  const res = await fetch("/api/students");
  if (!res.ok) throw new Error("Failed to sync students from server");
  const data = await res.json();

  // Merge server DB into the local in-memory object
  Object.assign(STUDENTS, data.students);
};

/** retrieves a student record by id. returns null if not found. */
export const getStudentByID = (studentId) => {
  const student = STUDENTS[studentId];
  if (!student) {
    console.warn(`Student ID ${studentId} not found in database`);
    return null;
  }
  return student;
};

/** checks if a student id exists in the database */
export const isValidStudentID = (studentId) => {
  return studentId in STUDENTS;
};

/** returns an array of all registered student id strings */
export const getAllValidStudentIDs = () => {
  return Object.keys(STUDENTS);
};

/** returns the face image path for a student, or null if not found */
export const getFaceImagePath = (studentId) => {
  const student = STUDENTS[studentId];
  return student ? student.faceImage : null;
};

/** adds a new student to the database. requires id, name, and faceimage. */
export const addStudent = (studentData) => {
  if (!studentData.id || !studentData.name || !studentData.faceImage) {
    throw new Error('Missing required student data');
  }
  STUDENTS[studentData.id] = studentData;
  console.log(`Added student: ${studentData.name} (${studentData.id})`);
};

export default {
  getStudentByID,
  isValidStudentID,
  getAllValidStudentIDs,
  getFaceImagePath,
  addStudent
};
