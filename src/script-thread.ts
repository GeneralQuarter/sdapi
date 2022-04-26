export interface Location {
  function_name?: string;
  line_number: number;
  script_path: string;
}

export interface StackFrame {
  index: number;
  location: Location;
}

export enum ScriptStatus {
  Halted = 'halted',
  Running = 'running',
}

export interface RunningScriptThread {
  id: number;
  status: ScriptStatus.Running;
}

export interface HaltedScriptThread {
  id: number;
  status: ScriptStatus.Halted;
  call_stack: StackFrame[];
}

export type ScriptThread = RunningScriptThread | HaltedScriptThread;

export interface ScriptThreads {
  script_threads: ScriptThread[];
}