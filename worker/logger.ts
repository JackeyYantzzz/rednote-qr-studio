type LogFields = Record<string, string | number | boolean | null | undefined>;

function write(level: "info" | "warn" | "error", message: string, fields: LogFields = {}) {
  const safeFields = Object.fromEntries(
    Object.entries(fields).filter(
      ([key]) => !/key|token|cookie|password|secret/i.test(key),
    ),
  );
  const record = {
    time: new Date().toISOString(),
    level,
    message,
    ...safeFields,
  };
  const line = JSON.stringify(record);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, fields?: LogFields) => write("info", message, fields),
  warn: (message: string, fields?: LogFields) => write("warn", message, fields),
  error: (message: string, fields?: LogFields) => write("error", message, fields),
};
