import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import { Breakpoints, DebuggerBreakpoint, DebuggerBreakpoints } from './breakpoint';
import { EvalResult } from './eval-result';
import { Faults } from './fault';
import { ObjectMembers, ScopedObjectMember } from './object-member';
import { ScriptThread, ScriptThreads } from './script-thread';

export interface Config {
  hostname: string;
  username: string;
  password: string;
  clientId: string;
}

const axiosErrorToFault = (error: AxiosError<any>) => {
  const Fault = Faults[error.response?.data?.fault?.type as keyof (typeof Faults)];

  if (!Fault) {
    return Promise.reject(error);
  }

  return Promise.reject(new Fault(error.response?.data?.fault?.message));
}

export default class SDAPI {
  private http: AxiosInstance;

  constructor(config: Config) {
    this.http = axios.create({
      baseURL: `https://${config.hostname}/s/-/dw/debugger/v2_0`,
      auth: {
        username: config.username,
        password: config.password
      },
      headers: {
        'x-dw-client-id': config.clientId,
      }
    });

    // transform fault into javascript error
    this.http.interceptors.response.use(res => res, axiosErrorToFault);
  }

  /**
   * Creates the Client and enables the debugger. 
   * You must create the Client before you can interact with other debugger resources
   */
  createClient() {
    return this.http.post('/client');
  }

  /**
   * Removes all breakpoints, resumes all halted script threads and disables the debugger by deleting the Client.
   */
  deleteClient() {
    return this.http.delete('/client');
  }

  /**
   * Returns all breakpoints currently set in the debugger.
   */
  getBreakpoints() {
    return this.http.get<DebuggerBreakpoints>('/breakpoints').then(res => res.data);
  }

  /**
   * Sets all breakpoints
   */
  createBreakpoints(breakpoints: Breakpoints) {
    return this.http.post<DebuggerBreakpoints, AxiosResponse<DebuggerBreakpoints>, Breakpoints>('/breakpoints', breakpoints).then(res => res.data);
  }

  /**
   * Removes all the breakpoints from the debugger.
   */
  removeBreakpoints() {
    return this.http.delete('/breakpoints');
  }

  /**
   * Gets a breakpoint. 
   * If the breakpoint cannot be located, this action throws a {@link Faults.BreakpointNotFoundException BreakpointNotFoundException}.
   */
  getBreakpoint(id: number) {
    return this.http.get<DebuggerBreakpoint>(`/breakpoints/${id}`).then(res => res.data);
  }

  /**
   * Deletes the breakpoint. 
   * If the breakpoint cannot be located, this action throws a {@link Faults.BreakpointNotFoundException BreakpointNotFoundException}.
   */
  removeBreakpoint(id: number) {
    return this.http.delete(`/breakpoints/${id}`);
  }

  /**
   * Returns the script threads in the script engine. 
   * A script thread is either 'running' or 'halted'. 
   * If the script thread is halted, the script thread contains a call stack of stack frames representing the execution path. 
   * The stack frame at index [0] represents the current location of the execution path. 
   * Both the script thread identifier and a stack frame index are required for evaluating expressions and viewing object state.
   */
  getScriptThreads() {
    return this.http.get<ScriptThreads>('/threads').then(res => res.data);
  }

  /**
   * Directs the debugger to reset the timeout counter for all halted script threads. 
   * Each script thread can sleep up to 60 seconds before the debugger will terminate the thread. 
   * This action resets the timeout counter allowing a thread to halt for another 60 seconds. 
   * Note that if a script thread times out, the script engine throws a ScriptDebuggerTerminate error in the script that was halted.
   */
  resetScriptThreads() {
    return this.http.post('/threads/reset');
  }

  /**
   * Returns the script thread specified by the thread identifier.
   */
  getScriptThread(id: number) {
    return this.http.get<ScriptThread>(`/threads/${id}`).then(res => res.data);
  }

  /**
   * Evaluates an expression in the context of the specified thread and frame. 
   */
  evaluateExpression(threadId: number, frameIndex: number, expr: string) {
    return this.http.get<EvalResult>(`/threads/${threadId}/frames/${frameIndex}/eval`, { params: { expr } })
      .then(res => res.data);
  }

  /**
   * Returns the members of the object path in the context of the specified thread and frame. 
   * If the object path is not specified, returns all members of the specified thread and frame.
   */
  getObjectMembers(threadId: number, frameIndex: number, objectPath?: string, start = 0, count = 200) {
    const params: { start: number, count: number, object_path?: string } = { start, count };

    if (objectPath) {
      params.object_path = objectPath;
    }

    return this.http.get<ObjectMembers>(`/threads/${threadId}/frames/${frameIndex}/members`, { params })
      .then(res => res.data);
  }

  /**
   * Returns the variables in the context of the specified thread and frame scope and all inclosing scopes. 
   */
  getVariables(threadId: number, frameIndex: number, start = 0, count = 200) {
    return this.http.get<ObjectMembers<ScopedObjectMember>>(
      `/threads/${threadId}/frames/${frameIndex}/variables`,
      { params: { start, count } }
    ).then(res => res.data);
  }

  private step(threadId: number, action: 'into' | 'out' | 'over' | 'resume' | 'stop') {
    return this.http.post<ScriptThread>(`/threads/${threadId}/${action}`).then(res => res.data);
  }

  /**
   * Directs the script thread to step into the function at the current thread location. 
   * If the current location is not a function, this action steps to the next line in the script. 
   * If there are no other lines in the script, the script completes. 
   * If the script thread cannot be located, this action throws a ScriptThreadNotFoundException.
   */
  stepInto(threadId: number) {
    return this.step(threadId, 'into');
  }

  /**
   * Directs the script thread to step out of the current thread location and to return to the parent in the call stack. 
   * If there is no parent in the call stack, this action directs the script thread to resume. 
   * If the script thread cannot be located, this action throws a ScriptThreadNotFoundException.
   */
  stepOut(threadId: number) {
    return this.step(threadId, 'out');
  }

  /**
   * Directs the script thread to step over the current thread location to the next line in the script. 
   * If the current location is at the end of a script function, this action directs the script thread to resume. 
   * If the script thread cannot be located, this action throws a ScriptThreadNotFoundException.
   */
  stepOver(threadId: number) {
    return this.step(threadId, 'over');
  }

  /**
   * Directs the script thread to resume the execution of the script. 
   * Depending on the script location and breakpoints, calling resume can result in the thread stopping at another breakpoint. 
   * If the script thread cannot be located, this action throws a ScriptThreadNotFoundException.
   */
  stepResume(threadId: number) {
    return this.step(threadId, 'resume');
  }

  /**
   * Directs the script thread to stop execution. 
   * This action directs the script engine to throw a ScriptDebuggerTerminate error in the script that was halted. 
   * If the script thread cannot be located, this action throws a ScriptThreadNotFoundException.
   */
  stepStop(threadId: number) {
    return this.step(threadId, 'stop');
  }
}