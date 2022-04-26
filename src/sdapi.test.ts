import SDAPI, { Config } from './sdapi';
import MockAdapter from 'axios-mock-adapter';
import { BreakpointNotFoundException, ClientIdRequiredException, DebuggerDisabledException, InvalidFrameIndexException, InvalidScriptFileException, InvalidScriptPathException, NotAuthorizedException, ScriptThreadNotFoundException } from './fault';
import { Breakpoint, Breakpoints, DebuggerBreakpoint, DebuggerBreakpoints } from './breakpoint';
import { ScriptStatus, ScriptThread, ScriptThreads } from './script-thread';
import { EvalResult } from './eval-result';
import { ObjectMember, ObjectMembers, ObjectMemberScope, ScopedObjectMember } from './object-member';

const faultResponse = (type: string, message: string) => {
  return {
    _v: '2.0',
    fault: {
      type,
      message
    }
  }
};

describe('SDAPI', () => {
  let axiosMock: MockAdapter;
  let sdapi: SDAPI;
  const mockConfig: Config = {
    clientId: 'TestSDAPI',
    hostname: 'localhost',
    username: 'username',
    password: 'password'
  }
  const breakpoint: Breakpoint = {
    line_number: 1,
    script_path: '/'
  };
  const thread: ScriptThread = {
    id: 1,
    status: ScriptStatus.Halted,
    call_stack: [
      {
        index: 0,
        location: {
          line_number: 1,
          script_path: '/',
          function_name: 'test()'
        }
      }
    ]
  }

  beforeAll(() => {
    sdapi = new SDAPI(mockConfig);
    axiosMock = new MockAdapter(sdapi['http']);
  });

  test('config', () => {
    expect(sdapi['http'].defaults.baseURL).toBe(`https://${mockConfig.hostname}/s/-/dw/debugger/v2_0`);
    expect(sdapi['http'].defaults.auth?.username).toBe(mockConfig.username);
    expect(sdapi['http'].defaults.auth?.password).toBe(mockConfig.password);
    expect((sdapi['http'].defaults.headers as any)['x-dw-client-id']).toBe(mockConfig.clientId);
  });

  test('Fault interceptor fallback', async () => {
    axiosMock.onPost('/client').reply(500, 'Internal Server Error');
    await expect(sdapi.createClient()).rejects.toThrowError('Request failed with status code 500');
  });

  describe('createClient', () => {
    test('OK', async () => {
      axiosMock.onPost('/client').reply(204);
      const res = await sdapi.createClient();
      expect(res.status).toBe(204);
    });

    test('NotAuthorizedException', async () => {
      axiosMock.onPost('/client').reply(401, faultResponse('NotAuthorizedException', 'You are not authorized to use the Script Debugger.'));
      await expect(sdapi.createClient()).rejects.toThrowError(NotAuthorizedException);
      await expect(sdapi.createClient()).rejects.toThrowError('You are not authorized to use the Script Debugger.');
    });

    test('ClientIdRequiredException', async () => {
      axiosMock.onPost('/client').reply(400, faultResponse('ClientIdRequiredException', 'You must have a client identifier in the request header using the key \'x-dw-client-id\'.'));
      await expect(sdapi.createClient()).rejects.toThrowError(ClientIdRequiredException);
      await expect(sdapi.createClient()).rejects.toThrowError('You must have a client identifier in the request header using the key \'x-dw-client-id\'.');
    });
  });

  test('deleteClient', async () => {
    axiosMock.onDelete('/client').reply(204);
    const res = await sdapi.deleteClient();
    expect(res.status).toBe(204);
  });

  describe('getBreakpoints', () => {
    test('OK', async () => {
      const breakpoints: DebuggerBreakpoints = {
        breakpoints: [
          {
            id: 1,
            line_number: 1,
            script_path: '/',
          }
        ]
      };
      axiosMock.onGet('/breakpoints').reply(200, breakpoints);
      await expect(sdapi.getBreakpoints()).resolves.toEqual(breakpoints);
    });

    test('DebuggerDisabledException', async () => {
      axiosMock.onGet('/breakpoints').reply(412, faultResponse('DebuggerDisabledException', 'Client not created.'));
      await expect(sdapi.getBreakpoints()).rejects.toThrowError(DebuggerDisabledException);
      await expect(sdapi.getBreakpoints()).rejects.toThrowError('Client not created.');
    });
  });

  describe('createBreakpoints', () => {
    const breakpoints: Breakpoints = { breakpoints: [breakpoint] };

    test('OK', async () => {
      const debuggerBreakpoints: DebuggerBreakpoints = {
        breakpoints: [{
          id: 1,
          ...breakpoint
        }]
      };
      axiosMock.onPost('/breakpoints').reply(200, debuggerBreakpoints);
      await expect(sdapi.createBreakpoints(breakpoints)).resolves.toEqual(debuggerBreakpoints);
    });

    test('InvalidScriptPathException', async () => {
      axiosMock.onPost('/breakpoints').reply(400, faultResponse('InvalidScriptPathException', 'Script Path must start with a forward slash \'/\'.'));
      await expect(sdapi.createBreakpoints(breakpoints)).rejects.toThrowError(InvalidScriptPathException);
      await expect(sdapi.createBreakpoints(breakpoints)).rejects.toThrowError('Script Path must start with a forward slash \'/\'.');
    });

    test('InvalidScriptFileException', async () => {
      axiosMock.onPost('/breakpoints').reply(400, faultResponse('InvalidScriptFileException', 'Script Path must be a JavaScript file with a suffix of \'.js\' or \'.ds\'.'));
      await expect(sdapi.createBreakpoints(breakpoints)).rejects.toThrowError(InvalidScriptFileException);
      await expect(sdapi.createBreakpoints(breakpoints)).rejects.toThrowError('Script Path must be a JavaScript file with a suffix of \'.js\' or \'.ds\'.');
    });
  });

  test('removeBreakpoints', async () => {
    axiosMock.onDelete('/breakpoints').reply(204);
    const res = await sdapi.removeBreakpoints();
    expect(res.status).toBe(204);
  });

  describe('getBreakpoint', () => {
    test('OK', async () => {
      const debuggerBreakpoint: DebuggerBreakpoint = { id: 1, ...breakpoint };
      axiosMock.onGet('/breakpoints/1').reply(200, debuggerBreakpoint);
      await expect(sdapi.getBreakpoint(1)).resolves.toEqual(debuggerBreakpoint);
    });

    test('BreakpointNotFoundException', async () => {
      axiosMock.onGet('/breakpoints/1').reply(404, faultResponse('BreakpointNotFoundException', 'Could not find Breakpoint for identifier \'1\''));
      await expect(sdapi.getBreakpoint(1)).rejects.toThrowError(BreakpointNotFoundException);
      await expect(sdapi.getBreakpoint(1)).rejects.toThrowError('Could not find Breakpoint for identifier \'1\'');
    });
  });

  test('removeBreakpoint', async () => {
    axiosMock.onDelete('/breakpoints/1').reply(204);
    const res = await sdapi.removeBreakpoint(1);
    expect(res.status).toBe(204);
  });

  test('getScriptThreads', async () => {
    const threads: ScriptThreads = {
      script_threads: [thread]
    };
    axiosMock.onGet('/threads').reply(200, threads);
    await expect(sdapi.getScriptThreads()).resolves.toEqual(threads);
  });

  test('resetScriptThreads', async () => {
    axiosMock.onPost('/threads/reset').reply(204);
    const res = await sdapi.resetScriptThreads();
    expect(res.status).toBe(204);
  });

  describe('getScriptThread', () => {
    test('OK', async () => {
      axiosMock.onGet('/threads/1').reply(200, thread);
      await expect(sdapi.getScriptThread(1)).resolves.toEqual(thread);
    });

    test('ScriptThreadNotFoundException', async () => {
      axiosMock.onGet('/threads/1').reply(404, faultResponse('ScriptThreadNotFoundException', 'Could not find Script Thread for identifier \'1\''));
      await expect(sdapi.getScriptThread(1)).rejects.toThrowError(ScriptThreadNotFoundException);
      await expect(sdapi.getScriptThread(1)).rejects.toThrowError('Could not find Script Thread for identifier \'1\'');
    });
  });

  describe('evaluateExpression', () => {
    const expression = 'calculate()';
    const params = { expr: expression };
    const evalResult: EvalResult = { expression, result: '100' };

    test('OK', async () => {
      axiosMock.onGet(`/threads/1/frames/0/eval`, { params }).reply(200, evalResult);
      await expect(sdapi.evaluateExpression(1, 0, expression)).resolves.toEqual(evalResult);
    });

    test('InvalidFrameIndexException', async () => {
      axiosMock.onGet(`/threads/1/frames/0/eval`, { params }).reply(404, faultResponse('InvalidFrameIndexException', 'Frame index \'0\' does not exist for Script Thread \'1\'.'));
      await expect(sdapi.evaluateExpression(1, 0, expression)).rejects.toThrowError(InvalidFrameIndexException);
      await expect(sdapi.evaluateExpression(1, 0, expression)).rejects.toThrowError('Frame index \'0\' does not exist for Script Thread \'1\'.');
    });
  });

  describe('getObjectMembers', () => {
    const objectMember: ObjectMember = {
      name: '[0]',
      parent: 'basket',
      type: 'dw.order.ProductLineItem',
      value: '[ProductLineItem uuid=bcDfLaOacbNVMaaadoDBceQDFh]',
    }
    const objectMembers: ObjectMembers = {
      object_members: [objectMember],
      count: 200,
      start: 0,
      total: 1
    }

    test('OK - no object path', async () => {
      const params = { start: 0, count: 200 }; // default values
      axiosMock.onGet('/threads/1/frames/0/members', { params }).reply(200, objectMembers);
      await expect(sdapi.getObjectMembers(1, 0)).resolves.toEqual(objectMembers);
    });

    test('OK - object path', async () => {
      const params = { start: 10, count: 100, object_path: 'basket.productLineItems' };
      axiosMock.onGet('/threads/1/frames/0/members', { params }).reply(200, objectMembers);
      await expect(sdapi.getObjectMembers(1, 0, 'basket.productLineItems', 10, 100)).resolves.toEqual(objectMembers);
    });
  });

  test('getVariables', async () => {
    const objectMember: ScopedObjectMember = {
      name: '[0]',
      parent: 'basket',
      type: 'dw.order.ProductLineItem',
      value: '[ProductLineItem uuid=bcDfLaOacbNVMaaadoDBceQDFh]',
      scope: ObjectMemberScope.Local,
    }
    const objectMembers: ObjectMembers<ScopedObjectMember> = {
      object_members: [objectMember],
      count: 200,
      start: 0,
      total: 1
    }

    const params = { start: 0, count: 200 }; // default values
    axiosMock.onGet('/threads/1/frames/0/variables', { params }).reply(200, objectMembers);
    await expect(sdapi.getVariables(1, 0)).resolves.toEqual(objectMembers);
  });

  test('stepInto', async () => {
    axiosMock.onPost('/threads/1/into').reply(200, thread);
    await expect(sdapi.stepInto(1)).resolves.toEqual(thread);
  });

  test('stepOut', async () => {
    axiosMock.onPost('/threads/1/out').reply(200, thread);
    await expect(sdapi.stepOut(1)).resolves.toEqual(thread);
  });

  test('stepOver', async () => {
    axiosMock.onPost('/threads/1/over').reply(200, thread);
    await expect(sdapi.stepOver(1)).resolves.toEqual(thread);
  });

  test('stepResume', async () => {
    axiosMock.onPost('/threads/1/resume').reply(200, thread);
    await expect(sdapi.stepResume(1)).resolves.toEqual(thread);
  });

  test('stepStop', async () => {
    axiosMock.onPost('/threads/1/stop').reply(200, thread);
    await expect(sdapi.stepStop(1)).resolves.toEqual(thread);
  });
});