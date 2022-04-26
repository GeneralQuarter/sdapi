export class NotAuthorizedException extends Error {}
export class ClientIdRequiredException extends Error {}
export class DebuggerDisabledException extends Error {}
export class InvalidScriptPathException extends Error {}
export class InvalidScriptFileException extends Error {}
export class BreakpointNotFoundException extends Error {}
export class ScriptThreadNotFoundException extends Error {}
export class InvalidFrameIndexException extends Error {}

export const Faults = {
  NotAuthorizedException,
  ClientIdRequiredException,
  DebuggerDisabledException,
  InvalidScriptPathException,
  InvalidScriptFileException,
  BreakpointNotFoundException,
  ScriptThreadNotFoundException,
  InvalidFrameIndexException
}