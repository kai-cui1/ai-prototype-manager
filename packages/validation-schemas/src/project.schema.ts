import { Type } from '@sinclair/typebox';

export const CreateProjectInput = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 128 }),
  displayName: Type.String({ minLength: 1, maxLength: 256 }),
  description: Type.Optional(Type.String({ maxLength: 4096 })),
});

export const UpdateProjectInput = Type.Partial(
  Type.Object({
    name: Type.Optional(Type.String({ minLength: 1, maxLength: 128 })),
    displayName: Type.Optional(Type.String({ minLength: 1, maxLength: 256 })),
    description: Type.Optional(Type.Union([Type.String({ maxLength: 4096 }), Type.Null()])),
    status: Type.Optional(Type.Union([Type.Literal('active'), Type.Literal('archived')])),
    config: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  })
);

export const ProjectQueryInput = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
  pageSize: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20 })),
  search: Type.Optional(Type.String({ maxLength: 256 })),
  status: Type.Optional(Type.Union([Type.Literal('active'), Type.Literal('archived')])),
});
