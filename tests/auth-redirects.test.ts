import { describe, expect, test } from "vitest";
import { homeForRole, safeReturnPath } from "@/lib/auth/redirects";

describe("auth redirect helpers", () => {
  test("routes roles to their dashboard", () => {
    expect(homeForRole("teacher")).toBe("/teacher/dashboard");
    expect(homeForRole("admin")).toBe("/teacher/dashboard");
    expect(homeForRole("student")).toBe("/student/dashboard");
    expect(homeForRole(undefined)).toBe("/student/dashboard");
  });

  test("rejects external or auth-page return paths", () => {
    expect(safeReturnPath("https://evil.test", "teacher")).toBe("/teacher/dashboard");
    expect(safeReturnPath("//evil.test", "teacher")).toBe("/teacher/dashboard");
    expect(safeReturnPath("/login?next=/teacher/dashboard", "teacher")).toBe("/teacher/dashboard");
    expect(safeReturnPath("/signup", "student")).toBe("/student/dashboard");
  });

  test("rejects role-incompatible return paths", () => {
    expect(safeReturnPath("/teacher/meetings", "student")).toBe("/student/dashboard");
    expect(safeReturnPath("/student/dashboard", "teacher")).toBe("/teacher/dashboard");
  });

  test("allows same-role and meeting return paths", () => {
    expect(safeReturnPath("/teacher/meetings?classId=abc", "teacher")).toBe("/teacher/meetings?classId=abc");
    expect(safeReturnPath("/student/classes/abc", "student")).toBe("/student/classes/abc");
    expect(safeReturnPath("/meeting/session-123", "student")).toBe("/meeting/session-123");
  });
});
