// A small CSV reader and writer for the snapshot scripts. Node-free and dependency-free, so it is easy to test.
// Standard quoting: a value is wrapped in `"` when it holds the separator, a quote or a line break, and `"` inside it
// is doubled. See docs/adr/0004.

export type Separator = "," | ";";
export type LineBreak = "\n" | "\r\n";

/** A file that cannot be read as CSV; the message says where. */
export class CsvError extends Error {
  constructor(
    /** What is wrong, without the line. */
    readonly reason: string,
    /** The line where it is wrong, when known. */
    readonly line?: number,
  ) {
    super(line === undefined ? reason : `${reason} on line ${line}`);
    this.name = "CsvError";
  }
}

export interface CsvRecord {
  fields: string[];
  /** The line of the file where the record starts, counting from 1. */
  line: number;
}

/** One record as text, without the line break. */
export function formatRow(fields: string[], separator: Separator): string {
  const needsQuotes = (value: string) => value.includes(separator) || /["\r\n]/.test(value);
  return fields.map((value) => (needsQuotes(value) ? `"${value.replaceAll('"', '""')}"` : value)).join(separator);
}

/** Reads the records of a CSV text (without a byte-order mark). Blank lines are skipped. */
export function parseCsv(text: string, separator: Separator): CsvRecord[] {
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let value = "";
  let line = 1;
  let startLine = 1;
  let quoted = false; // inside a quoted value
  let wasQuoted = false; // the current value opened with a quote
  let touched = false; // the current record has any character

  const endValue = () => {
    fields.push(value);
    value = "";
    wasQuoted = false;
  };
  const endRecord = () => {
    if (touched) {
      endValue();
      records.push({ fields, line: startLine });
    }
    fields = [];
    value = "";
    wasQuoted = false;
    touched = false;
  };
  const fail = (what: string): never => {
    throw new CsvError(what, line);
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        if (char === "\n") line++;
        value += char;
      }
      continue;
    }
    if (char === "\r" && text[i + 1] === "\n") continue;
    if (char === "\n") {
      endRecord();
      line++;
      continue;
    }
    if (!touched) {
      touched = true;
      startLine = line;
    }
    if (char === separator) {
      endValue();
    } else if (char === '"') {
      if (value !== "" || wasQuoted) fail("A quote in the middle of a value");
      quoted = true;
      wasQuoted = true;
    } else {
      if (wasQuoted) fail("Text after a closing quote");
      value += char;
    }
  }
  if (quoted) {
    throw new CsvError("A quote is opened and never closed", startLine);
  }
  endRecord();
  return records;
}

/**
 * Splits the header line with the separator that finds the `id` column: `,` or `;`. When neither does, `,` is used so
 * the missing `id` can be reported. Throws when both do, but split the header differently.
 */
export function splitHeader(header: string): { separator: Separator; columns: string[] } {
  const attempts = ([",", ";"] as const).flatMap((separator) => {
    try {
      const columns = parseCsv(header, separator)[0]?.fields ?? [];
      return columns.includes("id") ? [{ separator, columns }] : [];
    } catch {
      return [];
    }
  });
  if (attempts.length === 0) {
    return { separator: ",", columns: parseCsv(header, ",")[0]?.fields ?? [] };
  }
  const [first, second] = attempts;
  if (second && first.columns.join("\0") !== second.columns.join("\0")) {
    throw new CsvError(`The header can be split with "," or with ";" and it is not clear which one is meant`);
  }
  return first;
}

/** `\r\n` when the text uses it (spreadsheets on Windows do), otherwise `\n`. */
export function detectLineBreak(text: string): LineBreak {
  return text.includes("\r\n") ? "\r\n" : "\n";
}
