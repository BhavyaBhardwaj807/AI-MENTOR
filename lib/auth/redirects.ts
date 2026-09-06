export function homeForRole(role?: string | null) {
  if (role === "teacher" || role === "admin") return "/teacher/dashboard";
  return "/student/dashboard";
}

export function safeReturnPath(candidate: string | null | undefined, role?: string | null) {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return homeForRole(role);
  }

  if (candidate.startsWith("/login") || candidate.startsWith("/signup")) {
    return homeForRole(role);
  }

  if (candidate.startsWith("/teacher") && role !== "teacher" && role !== "admin") {
    return homeForRole(role);
  }

  if (candidate.startsWith("/student") && role !== "student" && role !== "admin") {
    return homeForRole(role);
  }

  return candidate;
}
