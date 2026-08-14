export function failedJobPatch(attemptCount: number, maxAttempts: number, message: string) {
  return {
    status: "failed" as const,
    error_message: message.slice(0, 2000),
    completed_at: attemptCount >= maxAttempts ? new Date().toISOString() : null,
  };
}
