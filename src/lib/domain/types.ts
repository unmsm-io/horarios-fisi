import type { Course, TeacherProfile } from "@/lib/domain/schedule-data";
import type { TeacherCourseImportResult } from "@/lib/domain/teacher-course-import";

export type AppRole = "docente" | "direccion" | "admin";

export type Onboarding = {
  role: AppRole;
  school: string;
  code: string;
  complete: boolean;
};

export type ScheduleIdentity = {
  ldapUid: string;
  email: string;
  imageUrl?: string;
  name: string;
  preview?: boolean;
  role?: AppRole;
  institutionalRoles?: string[];
  /** @deprecated use ldapUid */
  clerkUserId?: string;
};

export type ScheduleSettings = {
  academicTerm: string;
  periodClosed: boolean;
  periodClosedAt?: string;
};

export type ScheduleEvent = {
  id: number;
  teacherId: string;
  actorUserId: string;
  actorName: string;
  eventType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ScheduleUser = {
  ldapUid: string;
  email: string;
  imageUrl?: string;
  name: string;
  role: AppRole;
  institutionalRoles?: string[];
  accountStatus?: string;
  school: string;
  onboardingComplete: boolean;
  lastSeenAt?: string;
  teacherCode?: string;
  teacherCategory?: string;
  academicDegree?: string;
  teacherStatus: TeacherProfile["status"] | null;
  updatedAt: string;
  createdAt: string;
  /** @deprecated use ldapUid */
  clerkUserId?: string;
};

export type SchedulePayload = {
  currentUserId: string;
  profile: TeacherProfile;
  teacherMode: "official" | "sandbox" | "administrative" | "preview";
  teachers: TeacherProfile[];
  users: ScheduleUser[];
  catalog: Course[];
  schools: string[];
  departments: string[];
  settings: ScheduleSettings;
  events: ScheduleEvent[];
  onboarding: Onboarding;
  canUseAdmin: boolean;
  canUseDirection: boolean;
  userName: string;
};

export type InstitutionalUserSyncInput = {
  ldapUid?: string;
  email: string;
  name: string;
  imageUrl?: string;
  role?: AppRole;
  institutionalRoles?: string[];
  accountStatus?: string;
  authUserId?: number;
  authAccountId?: number;
  code?: string;
  school?: string;
  /** @deprecated use ldapUid */
  clerkUserId?: string;
};

export type ClerkUserSyncInput = InstitutionalUserSyncInput;

export type TeacherCourseImportResponse = Omit<
  TeacherCourseImportResult,
  "resolvedAssignments"
> & {
  applied: boolean;
  replaceTeachers: boolean;
  payload: SchedulePayload;
};

export class ScheduleError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
