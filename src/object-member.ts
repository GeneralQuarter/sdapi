export enum ObjectMemberScope {
  Local = 'local',
  Closure = 'closure',
  Global = 'global',
}

export interface ObjectMember {
  name: string;
  parent: string;
  type: string;
  value: string;
}

export interface ScopedObjectMember extends ObjectMember {
  scope: ObjectMemberScope;
}

export interface ObjectMembers<T extends ObjectMember = ObjectMember> {
  object_members: T[];
  start: number;
  count: number;
  total: number;
}