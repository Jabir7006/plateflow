export type ReportRangePreset = "today" | "7d" | "30d" | "all" | "custom";

export interface OrderReportRange {
  preset?: ReportRangePreset;
  fromDate?: string;
  toDate?: string;
  // Legacy explicit instants remain supported. They cannot be mixed with a
  // calendar preset; new UI requests let the server resolve restaurant days.
  from?: string;
  to?: string;
}

export interface ReportingPeriod {
  timeZone: string;
  from: string | null;
  to: string | null;
  // Calendar end dates include their entire day via the next midnight's lt.
  // Legacy explicit ISO ranges retain their existing inclusive upper bound.
  toExclusive: boolean;
}
