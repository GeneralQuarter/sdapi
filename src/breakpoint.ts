export interface Breakpoint {
  condition?: string;
  line_number: number;
  script_path: string;
}

export interface Breakpoints {
  breakpoints: Breakpoint[];
}

export interface DebuggerBreakpoint extends Breakpoint {
  id: number;
}

export interface DebuggerBreakpoints {
  breakpoints: DebuggerBreakpoint[];
}