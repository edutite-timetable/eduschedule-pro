export interface TimeSlot {
  type: 'lesson' | 'break' | 'assembly';
  label: string;
  startTime?: string;
  endTime?: string;
}

export interface TeacherAssignment {
  grade: number;
  streamIndex: number;
  subject: string;
  lessons: number;
}

export interface Teacher {
  id: string;
  name: string;
  maxLessons: number;
  maxPerDay: number;
  unavailDays: string[];
  isSpecial?: boolean;
  color?: string;
  assignments: TeacherAssignment[];
}

export interface CommonSession {
  enabled: boolean;
  name?: string;
  day?: string;
  slotIndex?: number;
}

export interface ScheduleConfig {
  schoolName: string;
  academicYear: string;
  workingDays: string[];
  timeSlots: TimeSlot[];
  grades: number[];
  targetGrades: number[];
  gradeStreams: Record<string, number>;
  gradeStreamNames: Record<string, string[]>;
  subjects: string[];
  highPrioritySubjects: string[];
  teachers: Record<string, Teacher>;
  commonSession: CommonSession;
  fillerLabel: string;
  maxReductionPerSubject: number;
  rules: {
    maxTeacherPerDay: number;
    allowConsecutiveLessons?: boolean;
    avoidFreeWorkingDays?: boolean;
  };
  blacklist: string[]; // "teacherName|grade"
  subjectBlacklist: string[]; // "subject|grade"
}

export interface TimetableCell {
  subject: string;
  teacher: string;
  grade: number;
  isCommon?: boolean;
  isFiller?: boolean;
}

export interface ClassTimetable {
  grade: number;
  streamIndex: number;
  streamName: string;
  days: Record<string, (TimetableCell | null)[]>;
}

export type GeneratedTimetable = Record<string, ClassTimetable>;

export interface PreflightIssue {
  type: string;
  teacher?: string;
  class?: string;
  required: number;
  maximum?: number;
  available?: number;
  capacity?: number;
  description?: string;
}

export interface PreflightResult {
  success: boolean;
  feasible: boolean;
  issues: PreflightIssue[];
  warnings: string[];
  capacityPerClass: number;
  totalRequiredLessons: number;
  totalTeacherCapacity: number;
}

export interface SolverStats {
  totalVariables: number;
  totalConstraints: number;
  solveTime: number;
  status: string;
  optimal: boolean;
  wallTime: number;
  branches: number;
  objective: number;
  fillers: number;
  missing: number;
}

export interface QualityDiagnostics {
  valid: boolean;
  label: 'Excellent' | 'Very Good' | 'Good' | 'Needs Review' | 'Critical' | 'Fallback';
  score: number;
  completeness: number;
  packing: number;
  taughtLessons: number;
  fillers: number;
  errors: Array<{ type: string; count?: number; class?: string; day?: string; slot?: number }>;
  warnings: Array<{ type: string; count?: number }>;
  teacherClashes: Array<{ teacher: string; day: string; slot: number; classes: string[] }>;
  classClashes: Array<{ class: string; day: string; slot: number }>;
  missingLessons: Array<{ grade: string; streamIndex: string; subject: string; required: number; assigned: number; missing: number }>;
  overloadedTeachers: Array<{ teacher: string; assigned: number; maximum?: number; day?: string; maximumPerDay?: number }>;
  teacherConsecutive: Array<{ teacher: string; day: string; slot: number }>;
  sameSubjectConsecutive: Array<{ class: string; day: string; slot: number; subject: string }>;
  freeWorkingDays: Array<{ class: string; daysWithoutLessons: string[] }>;
  ineligibleTeachers: Array<{ class: string; grade: string; streamIndex: string; subject: string; teacher: string; day: string; slot: number }>;
  teacherUnavailable: Array<{ teacher: string; day: string; class: string; slot: number }>;
  blacklistViolations: Array<{ class: string; grade: string; subject?: string; teacher?: string; day: string; slot: number }>;
  distributionIssues: Array<{ class: string; day: string; repeatedSubjects: Record<string, number> }>;
  fairnessIssues: Array<{ teacher: string; assigned: number; delta: number }>;
  teacherLoad: Record<string, number>;
  teacherDailyLoad: Record<string, Record<string, number>>;
}

export interface GenerationResponse {
  success: boolean;
  message?: string;
  timetable?: GeneratedTimetable;
  stats?: SolverStats;
  violations?: Array<{ description: string; severity: string; value: number; penalty: number; coveragePct: number }>;
  reductions?: string[];
  fillers?: number;
  missing?: number;
  quality?: {
    completeness: number;
    packing: number;
    label: string;
    verified: boolean;
    score?: number;
  };
  diagnostics?: QualityDiagnostics;
}

export interface RepairCandidate {
  day: string;
  slot: number;
  score: number;
  reasons: string[];
}
