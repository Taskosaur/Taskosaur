import {
  BadRequestException,
  ConflictException,
  ExecutionContext,
  ValidationPipe,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  OrganizationDocumentsController,
  DocumentsController,
  WorkspaceDocumentsController,
} from './documents.controller';
import { DocumentReference, DocumentsService } from './documents.service';

describe('Repository documents', () => {
  let directory: string;
  let root: string;
  let config: string;
  let service: DocumentsService;
  const findFirst = jest.fn();
  const projectFindUnique = jest.fn();
  const workspaceFindUnique = jest.fn();
  const organizationFindUnique = jest.fn();
  const projectMemberFindUnique = jest.fn();
  const workspaceMemberFindUnique = jest.fn();
  const organizationMemberFindUnique = jest.fn();
  const organizationId = '44444444-4444-4444-4444-444444444444';
  const user = { id: '11111111-1111-1111-1111-111111111111', role: Role.MEMBER };
  let prisma: PrismaService;
  beforeEach(async () => {
    jest.resetAllMocks();
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'taskosaur-docs-test-'));
    root = path.join(directory, 'docs');
    config = path.join(directory, 'config.json');
    await fs.mkdir(root);
    await fs.writeFile(path.join(root, 'README.md'), '# First\nText');
    await fs.writeFile(path.join(directory, 'outside.md'), 'private');
    await fs.writeFile(
      config,
      JSON.stringify([{ projectId: 'project', root, label: 'Docs', entrypoint: 'README.md' }]),
    );
    findFirst.mockResolvedValue({ id: 'task' });
    projectFindUnique.mockResolvedValue({
      name: 'Project name',
      workspaceId: 'workspace',
      visibility: 'PRIVATE',
    });
    workspaceFindUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({
        name: where.id === 'workspace' ? 'Workspace name' : 'Parent workspace',
        organizationId,
        parentWorkspaceId: null,
      }),
    );
    organizationFindUnique.mockResolvedValue({ name: 'Organization name' });
    projectMemberFindUnique.mockResolvedValue({ role: Role.MEMBER });
    workspaceMemberFindUnique.mockResolvedValue({ role: Role.VIEWER });
    organizationMemberFindUnique.mockResolvedValue({ role: Role.VIEWER });
    prisma = {
      task: { findFirst },
      project: { findUnique: projectFindUnique },
      workspace: { findUnique: workspaceFindUnique },
      organization: { findUnique: organizationFindUnique },
      projectMember: { findUnique: projectMemberFindUnique },
      workspaceMember: { findUnique: workspaceMemberFindUnique },
      organizationMember: { findUnique: organizationMemberFindUnique },
    } as unknown as PrismaService;
    service = new DocumentsService(new ConfigService({ TASKOSAUR_DOCS_CONFIG: config }), prisma);
  });
  afterEach(async () => {
    await fs.rm(directory, { recursive: true, force: true });
  });
  it.each([
    '../outside.md',
    '/outside.md',
    'C:/outside.md',
    '.git/config.md',
    'node_modules/package/README.md',
    'secrets.md',
    'README.md:stream',
    'README.txt',
  ])('rejects forbidden path %s', async (relative) => {
    await expect(service.read('project', relative)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects a junction escaping the root for reads and writes', async () => {
    await fs.symlink(
      directory,
      path.join(root, 'escape'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    await expect(service.read('project', 'escape/outside.md')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.save('project', 'escape/outside.md', 'changed', 'revision'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(await fs.readFile(path.join(directory, 'outside.md'), 'utf8')).toBe('private');
  });
  it('serializes competing saves and rejects the stale revision', async () => {
    const original = await service.read('project', 'README.md');
    const results = await Promise.allSettled([
      service.save('project', 'README.md', '# Winner', original.revision),
      service.save('project', 'README.md', '# Loser', original.revision),
    ]);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1]).toMatchObject({ status: 'rejected', reason: expect.any(ConflictException) });
    expect((await service.read('project', 'README.md')).content).toBe('# Winner');
    expect(await fs.readdir(root)).toEqual(['README.md']);
  });
  it('detects edits made by external tools before a save', async () => {
    const original = await service.read('project', 'README.md');
    await fs.writeFile(path.join(root, 'README.md'), 'external');
    await expect(
      service.save('project', 'README.md', 'overwrite', original.revision),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('validates task scope and persists links without losing other tasks', async () => {
    await Promise.all([
      service.saveLinks('project', 'one', ['README.md']),
      service.saveLinks('project', 'two', ['README.md']),
    ]);
    const expected = {
      paths: ['README.md'],
      references: [{ scope: 'project', ownerId: 'project', path: 'README.md' }],
    };
    expect(await service.links('project', 'one')).toEqual(expected);
    expect(await service.links('project', 'two')).toEqual(expected);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'one', projectId: 'project' },
      select: { id: true },
    });
    findFirst.mockResolvedValue(null);
    await expect(service.saveLinks('project', 'foreign', ['README.md'])).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
  it('bounds documents and searches content while skipping hidden directories', async () => {
    await fs.mkdir(path.join(root, '.obsidian'));
    await fs.writeFile(path.join(root, '.obsidian', 'hidden.md'), '# Hidden');
    await fs.writeFile(path.join(root, 'large.md'), 'a'.repeat(204801));
    const result = await service.list('project', 'text');
    expect(result.documents).toEqual([{ path: 'README.md', title: 'First' }]);
    expect(result.truncated).toBe(true);
  });
  it('uses source metadata for read, list, sources and displayed subject search', async () => {
    const content =
      '<!-- taskosaur: {"title":"Own display title","subjects":["Human subject","Subtopic"],"category":"Knowledge","headingAliases":{"intro":"Introduction"},"future":true} -->\n# Source heading\nBody';
    await fs.writeFile(path.join(root, 'README.md'), content);
    const summary = {
      path: 'README.md',
      title: 'Own display title',
      subjects: ['Human subject', 'Subtopic'],
      category: 'Knowledge',
    };
    expect(await service.read('project', 'README.md')).toMatchObject({ ...summary, content });
    expect((await service.list('project', 'display title')).documents).toEqual([summary]);
    expect((await service.list('project', 'human subject')).documents).toEqual([summary]);
    const result = await service.listSources('project', 'project', user, 'human subject');
    expect(result.sources[0].documents).toEqual([summary]);
  });
  it.each([
    '<!-- taskosaur: {broken} -->',
    '<!-- taskosaur: {"title":17,"subjects":["Valid",null],"category":"Other"} -->',
    '<!-- taskosaur: {"title":"' + 'x'.repeat(8200) + '"} -->',
    '# First\n<!-- taskosaur: {"title":"Later","subjects":["Ignored"]} -->',
  ])('keeps malformed or misplaced metadata harmless: %s', async (header) => {
    await fs.writeFile(path.join(root, 'README.md'), header + '\n# First\nText');
    expect((await service.list('project')).documents).toEqual([
      { path: 'README.md', title: 'First' },
    ]);
  });
  it('distinguishes explicit root subjects from absent folder metadata', async () => {
    await fs.mkdir(path.join(root, 'physical'));
    await fs.writeFile(path.join(root, 'physical', 'plain.md'), '# Plain');
    await fs.writeFile(
      path.join(root, 'physical', 'home.md'),
      '<!-- taskosaur: {"subjects":[]} -->\n# Home',
    );
    expect((await service.list('project')).documents).toEqual([
      { path: 'physical/home.md', title: 'Home', subjects: [] },
      { path: 'physical/plain.md', title: 'Plain' },
      { path: 'README.md', title: 'First' },
    ]);
  });
  it('creates nested Markdown documents with a usable revision', async () => {
    const created = await service.create('project', 'guides/setup/start.md', ' Getting started ');
    expect(created).toMatchObject({
      path: 'guides/setup/start.md',
      title: 'Getting started',
      content: '# Getting started\n',
    });
    expect(created.revision).toMatch(/^[a-f0-9]{64}$/);
    expect(await service.read('project', created.path)).toEqual(created);
  });
  it('never overwrites an existing document, including concurrent creates', async () => {
    await expect(service.create('project', 'README.md', 'Overwrite')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect((await service.read('project', 'README.md')).content).toBe('# First\nText');
    const results = await Promise.allSettled([
      service.create('project', 'nested/new.md', 'One'),
      service.create('project', 'nested/new.md', 'Two'),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toEqual([
      expect.objectContaining({ reason: expect.any(ConflictException) }),
    ]);
  });
  it('creates different documents concurrently in the same new folder', async () => {
    await Promise.all([
      service.create('project', 'shared/one.md', 'One'),
      service.create('project', 'shared/two.md', 'Two'),
    ]);
    expect(await fs.readdir(path.join(root, 'shared'))).toEqual(['one.md', 'two.md']);
  });
  it.each([
    '../escaped.md',
    '.git/hidden.md',
    'secrets/key.md',
    'node_modules /bad.md',
    'nul.md',
    'README.md/new.md',
    'folder/'.repeat(17) + 'deep.md',
  ])('rejects unsafe creation path %s', async (relative) => {
    await expect(service.create('project', relative, 'Title')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(await fs.readdir(root)).toEqual(['README.md']);
  });
  it('rejects creation through an escaping junction before creating any child', async () => {
    await fs.symlink(
      directory,
      path.join(root, 'escape'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    await expect(
      service.create('project', 'escape/new/secret.md', 'Escape'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(fs.stat(path.join(directory, 'new'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it.each(['', '  ', 'Two\nlines', 'Two\rlines', 'a'.repeat(201)])(
    'rejects invalid title %j',
    async (title) => {
      await expect(service.create('project', 'new.md', title)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(await fs.readdir(root)).toEqual(['README.md']);
    },
  );
  async function layeredConfig(links: (string | DocumentReference)[] = []) {
    const workspaceRoot = path.join(directory, 'workspace-docs');
    const organizationRoot = path.join(directory, 'organization-docs');
    for (const sourceRoot of [workspaceRoot, organizationRoot]) {
      await fs.mkdir(sourceRoot);
      await fs.writeFile(path.join(sourceRoot, 'README.md'), '# Parent document\nShared guidance');
    }
    const sources = [
      {
        projectId: 'project',
        root,
        label: 'Docs',
        entrypoint: 'README.md',
        custom: 'preserve',
        taskLinks: { task: links, other: ['README.md'] },
      },
      {
        scope: 'workspace',
        ownerId: 'workspace',
        root: workspaceRoot,
        label: 'Workspace docs',
        entrypoint: 'README.md',
      },
      {
        scope: 'organization',
        ownerId: organizationId,
        root: organizationRoot,
        label: 'Organization docs',
        entrypoint: 'README.md',
      },
    ];
    await fs.writeFile(config, JSON.stringify(sources));
    return { sources, workspaceRoot, organizationRoot };
  }
  const workspaceReference: DocumentReference = {
    scope: 'workspace',
    ownerId: 'workspace',
    path: 'README.md',
  };
  const organizationReference: DocumentReference = {
    scope: 'organization',
    ownerId: organizationId,
    path: 'README.md',
  };
  it('keeps same-named documents separate and uses each actual owner permission', async () => {
    const { workspaceRoot, organizationRoot } = await layeredConfig();
    const result = await service.listSources('project', 'project', user);
    expect(
      result.sources.map(({ scope, ownerId, ownerName, canEdit }) => ({
        scope,
        ownerId,
        ownerName,
        canEdit,
      })),
    ).toEqual([
      { scope: 'project', ownerId: 'project', ownerName: 'Project name', canEdit: true },
      { scope: 'workspace', ownerId: 'workspace', ownerName: 'Workspace name', canEdit: false },
      {
        scope: 'organization',
        ownerId: organizationId,
        ownerName: 'Organization name',
        canEdit: false,
      },
    ]);
    expect(result.sources.map((source) => source.documents)).toEqual([
      [{ path: 'README.md', title: 'First' }],
      [{ path: 'README.md', title: 'Parent document' }],
      [{ path: 'README.md', title: 'Parent document' }],
    ]);
    expect(result.sources.every((source) => !('root' in source))).toBe(true);
    expect(JSON.stringify(result)).not.toContain(workspaceRoot);
    expect(JSON.stringify(result)).not.toContain(organizationRoot);
    expect((await service.read(organizationId, 'README.md', 'organization')).content).toContain(
      'Shared guidance',
    );
    expect(await service.list('project', 'shared')).toMatchObject({ documents: [] });
    expect(
      (await service.listSources('project', 'project', user, 'shared')).sources[0].documents,
    ).toEqual([]);
  });
  it('denies parent writes through the actual scoped controller guard', async () => {
    await layeredConfig();
    const guard = new RolesGuard(new Reflector(), prisma);
    for (const [controller, params] of [
      [OrganizationDocumentsController, { organizationId }],
      [WorkspaceDocumentsController, { workspaceId: 'workspace' }],
    ] as const) {
      const context = {
        getHandler: () => controller.prototype.save,
        getClass: () => controller,
        switchToHttp: () => ({
          getRequest: () => ({ user, params, method: 'PUT', body: { projectId: 'project' } }),
        }),
      } as unknown as ExecutionContext;
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    }
    const context = {
      getHandler: () => DocumentsController.prototype.save,
      getClass: () => DocumentsController,
      switchToHttp: () => ({
        getRequest: () => ({ user, params: { projectId: 'project' }, method: 'PUT' }),
      }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
  async function descendantConfig() {
    const { sources } = await layeredConfig();
    const extras = [
      { scope: 'workspace', ownerId: 'child' },
      { scope: 'workspace', ownerId: 'sibling' },
      { scope: 'project', ownerId: 'nested-project' },
      { scope: 'project', ownerId: 'foreign-project' },
      { scope: 'project', ownerId: 'missing-project' },
    ];
    for (const owner of extras) {
      const sourceRoot = path.join(directory, owner.ownerId);
      await fs.mkdir(sourceRoot);
      await fs.writeFile(path.join(sourceRoot, 'README.md'), '# Descendant');
      sources.push({ ...owner, root: sourceRoot, label: owner.ownerId, entrypoint: 'README.md' });
    }
    await fs.writeFile(config, JSON.stringify(sources));
    workspaceFindUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({
        name: where.id,
        organizationId: where.id === 'foreign' ? 'other-org' : organizationId,
        parentWorkspaceId: where.id === 'child' ? 'workspace' : null,
      }),
    );
    projectFindUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        where.id === 'missing-project'
          ? null
          : {
              name: where.id,
              workspaceId:
                where.id === 'nested-project'
                  ? 'child'
                  : where.id === 'foreign-project'
                    ? 'foreign'
                    : 'workspace',
              visibility: 'PRIVATE',
            },
      ),
    );
  }
  it('keeps descendant discovery opt-in and includes nested registered homes for organizations', async () => {
    await descendantConfig();
    expect(
      (await service.listSources('organization', organizationId, user)).sources.map(
        (source) => source.ownerId,
      ),
    ).toEqual([organizationId]);
    const result = await service.listSources('organization', organizationId, user, '', true);
    expect(result.sources.map((source) => source.ownerId)).toEqual([
      organizationId,
      'project',
      'workspace',
      'child',
      'sibling',
      'nested-project',
    ]);
    expect(result.sources.find((source) => source.ownerId === 'nested-project')?.lineage).toEqual([
      { scope: 'organization', ownerId: organizationId, ownerName: 'Organization name' },
      { scope: 'workspace', ownerId: 'workspace', ownerName: 'workspace' },
      { scope: 'workspace', ownerId: 'child', ownerName: 'child' },
      { scope: 'project', ownerId: 'nested-project', ownerName: 'nested-project' },
    ]);
    expect(result.sources.find((source) => source.ownerId === 'child')?.canEdit).toBe(false);
    expect(result.sources.find((source) => source.ownerId === 'nested-project')?.canEdit).toBe(
      true,
    );
  });
  it('limits workspace descendants to its subtree and project discovery to local plus parents', async () => {
    await descendantConfig();
    expect(
      (await service.listSources('workspace', 'workspace', user, '', true)).sources.map(
        (source) => source.ownerId,
      ),
    ).toEqual(['workspace', organizationId, 'project', 'child', 'nested-project']);
    expect(
      (await service.listSources('project', 'nested-project', user, '', true)).sources.map(
        (source) => source.ownerId,
      ),
    ).toEqual(['nested-project', 'child', 'workspace', organizationId]);
  });
  it('filters inaccessible descendant homes and ancestor names independently from writes', async () => {
    await descendantConfig();
    workspaceMemberFindUnique.mockImplementation(
      ({ where }: { where: { userId_workspaceId: { workspaceId: string } } }) =>
        Promise.resolve(
          where.userId_workspaceId.workspaceId === 'child' ? null : { role: Role.VIEWER },
        ),
    );
    projectMemberFindUnique.mockImplementation(
      ({ where }: { where: { userId_projectId: { projectId: string } } }) =>
        Promise.resolve(
          where.userId_projectId.projectId === 'project' ? null : { role: Role.VIEWER },
        ),
    );
    const result = await service.listSources('organization', organizationId, user, '', true);
    expect(result.sources.map((source) => source.ownerId)).toEqual([
      organizationId,
      'workspace',
      'sibling',
      'nested-project',
    ]);
    expect(result.sources.find((source) => source.ownerId === 'nested-project')?.lineage).toEqual([
      { scope: 'organization', ownerId: organizationId, ownerName: 'Organization name' },
      { scope: 'workspace', ownerId: 'workspace', ownerName: 'workspace' },
      { scope: 'project', ownerId: 'nested-project', ownerName: 'nested-project' },
    ]);
    expect(result.sources.every((source) => !source.canEdit)).toBe(true);
    expect(JSON.stringify(result)).not.toContain('foreign');
    expect(JSON.stringify(result)).not.toContain('child');
  });
  it('validates the opt-in source query and forwards its boolean value', async () => {
    const controller = new OrganizationDocumentsController(service);
    const queryType = Reflect.getMetadata('design:paramtypes', controller, 'sources')[1];
    const pipe = new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    });
    const listSources = jest.spyOn(service, 'listSources').mockResolvedValue({ sources: [] });
    for (const includeChildren of [undefined, 'false', 'true']) {
      const query = await pipe.transform(includeChildren === undefined ? {} : { includeChildren }, {
        type: 'query',
        metatype: queryType,
      });
      await controller.sources({ organizationId }, query, { user });
      expect(listSources).toHaveBeenLastCalledWith(
        'organization',
        organizationId,
        user,
        undefined,
        includeChildren === 'true',
      );
    }
    await expect(
      pipe.transform({ includeChildren: 'yes' }, { type: 'query', metatype: queryType }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('discovers authorized parents without a configured local source', async () => {
    const { sources } = await layeredConfig();
    await fs.writeFile(config, JSON.stringify(sources.slice(1)));
    expect(
      (await service.listSources('project', 'project', user)).sources.map((source) => source.scope),
    ).toEqual(['workspace', 'organization']);
    expect(await service.links('project', 'task', user)).toEqual({ paths: [], references: [] });
  });
  it('omits inaccessible parent sources and link metadata without dropping stored links', async () => {
    await layeredConfig(['README.md', organizationReference]);
    organizationMemberFindUnique.mockResolvedValue(null);
    expect(
      (await service.listSources('project', 'project', user)).sources.map((source) => source.scope),
    ).toEqual(['project', 'workspace']);
    expect((await service.links('project', 'task', user)).references).toEqual([
      { scope: 'project', ownerId: 'project', path: 'README.md' },
    ]);
    expect(await service.saveReferences('project', 'task', [workspaceReference], user)).toEqual({
      paths: [],
      references: [workspaceReference],
    });
    const stored = JSON.parse(await fs.readFile(config, 'utf8')) as {
      projectId?: string;
      scope?: string;
      custom?: string;
      taskLinks?: Record<string, (string | DocumentReference)[]>;
    }[];
    expect(stored[0]).toMatchObject({
      projectId: 'project',
      custom: 'preserve',
      taskLinks: { task: [organizationReference, workspaceReference], other: ['README.md'] },
    });
    expect(stored[0].scope).toBeUndefined();
    await expect(
      service.saveReferences('project', 'task', [organizationReference], user),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('normalizes legacy links and lets legacy paths replace only local project references', async () => {
    await layeredConfig(['README.md', workspaceReference, organizationReference]);
    expect(await service.links('project', 'task', user)).toEqual({
      paths: ['README.md'],
      references: [
        { scope: 'project', ownerId: 'project', path: 'README.md' },
        workspaceReference,
        organizationReference,
      ],
    });
    expect(await service.saveLinks('project', 'task', [], user)).toEqual({
      paths: [],
      references: [workspaceReference, organizationReference],
    });
    expect(
      await service.saveReferences(
        'project',
        'task',
        [
          workspaceReference,
          organizationReference,
          { scope: 'project', ownerId: 'project', path: 'README.md' },
        ],
        user,
      ),
    ).toMatchObject({ paths: ['README.md'] });
    expect((await service.links('project', 'task', user)).references).toHaveLength(3);
  });
  it.each([
    { scope: 'organization', ownerId: '55555555-5555-5555-5555-555555555555', path: 'README.md' },
    { scope: 'project', ownerId: 'unrelated-project', path: 'README.md' },
    { scope: 'workspace', ownerId: 'unrelated-workspace', path: 'README.md' },
  ] as DocumentReference[])(
    'rejects unrelated source references even for SUPER_ADMIN: %j',
    async (reference) => {
      await layeredConfig();
      await expect(
        service.saveReferences('project', 'task', [reference], { ...user, role: Role.SUPER_ADMIN }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect((await service.links('project', 'task', user)).references).toEqual([]);
    },
  );
  it('inherits nested workspaces only inside the project organization and bounds cycles', async () => {
    const { sources } = await layeredConfig();
    const parentRoot = path.join(directory, 'parent-docs');
    await fs.mkdir(parentRoot);
    await fs.writeFile(path.join(parentRoot, 'README.md'), '# Ancestor');
    await fs.writeFile(
      config,
      JSON.stringify([
        ...sources,
        {
          scope: 'workspace',
          ownerId: 'parent',
          root: parentRoot,
          label: 'Ancestor',
          entrypoint: 'README.md',
        },
      ]),
    );
    workspaceFindUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({
        name: where.id,
        organizationId,
        parentWorkspaceId: where.id === 'workspace' ? 'parent' : 'workspace',
      }),
    );
    expect(
      (await service.listSources('project', 'project', user)).sources.map(
        (source) => source.ownerId,
      ),
    ).toEqual(['project', 'workspace', 'parent', organizationId]);
    expect(workspaceFindUnique).toHaveBeenCalledTimes(2);
    workspaceFindUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({
        name: where.id,
        organizationId: where.id === 'parent' ? 'other-org' : organizationId,
        parentWorkspaceId: where.id === 'workspace' ? 'parent' : null,
      }),
    );
    expect(
      (await service.listSources('project', 'project', user)).sources.map(
        (source) => source.ownerId,
      ),
    ).toEqual(['project', 'workspace', organizationId]);
  });
  it('rejects duplicate owners and overlapping roots before any lower-scope write', async () => {
    const { sources, organizationRoot } = await layeredConfig();
    await fs.writeFile(config, JSON.stringify([...sources, sources[0]]));
    await expect(service.read('project', 'README.md')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    const nested = path.join(organizationRoot, 'project');
    await fs.mkdir(nested);
    sources[0].root = nested;
    await fs.writeFile(config, JSON.stringify(sources));
    await expect(service.create('project', 'new.md', 'Blocked')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(await fs.readdir(nested)).toEqual([]);
  });
  it('rejects roots aliased through a junction to another owner', async () => {
    const { sources, organizationRoot } = await layeredConfig();
    const alias = path.join(directory, 'alias');
    await fs.symlink(organizationRoot, alias, process.platform === 'win32' ? 'junction' : 'dir');
    sources[0].root = alias;
    await fs.writeFile(config, JSON.stringify(sources));
    await expect(service.list('project')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  async function migratedConfig() {
    const targetId = '99999999-9999-4999-8999-999999999999';
    const targetRoot = path.join(directory, 'migrated');
    await fs.mkdir(targetRoot);
    await fs.writeFile(path.join(targetRoot, 'README.md'), '# Canonical');
    await fs.writeFile(
      config,
      JSON.stringify([
        {
          projectId: 'project',
          root,
          label: 'Current work',
          entrypoint: 'README.md',
          legacyRedirects: {
            'legacy.md': { scope: 'project', ownerId: targetId, path: 'README.md' },
          },
        },
        {
          scope: 'project',
          ownerId: targetId,
          root: targetRoot,
          label: 'Taskosaur',
          entrypoint: 'README.md',
        },
      ]),
    );
    return targetId;
  }
  it('preserves moved document reads, writes and exact task references with one canonical copy', async () => {
    const targetId = await migratedConfig();
    const original = await service.read('project', 'legacy.md', 'project', user);
    expect(original).toMatchObject({
      title: 'Canonical',
      canonicalReference: { ownerId: targetId, path: 'README.md' },
    });
    await service.save('project', 'legacy.md', '# Updated', original.revision, 'project', user);
    expect((await service.read(targetId, 'README.md')).content).toBe('# Updated');
    expect((await service.list('project')).documents.map((d) => d.path)).toEqual(['README.md']);
    expect(
      (await service.listSources('project', 'project', user)).sources.map((s) => s.ownerId),
    ).toEqual(['project', targetId]);
    await expect(service.create('project', 'legacy.md', 'Duplicate')).rejects.toBeInstanceOf(
      ConflictException,
    );
    await service.saveReferences(
      'project',
      'task',
      [{ scope: 'project', ownerId: targetId, path: 'README.md' }],
      user,
    );
    expect((await service.links('project', 'task', user)).references).toEqual([
      { scope: 'project', ownerId: targetId, path: 'README.md' },
    ]);
    await expect(
      service.saveReferences(
        'project',
        'task',
        [{ scope: 'project', ownerId: targetId, path: 'other.md' }],
        user,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('checks both homes and independent edit rights for legacy destinations', async () => {
    const targetId = await migratedConfig();
    projectMemberFindUnique.mockImplementation(({ where }) =>
      Promise.resolve(where.userId_projectId.projectId === targetId ? null : { role: Role.MEMBER }),
    );
    await expect(service.read('project', 'legacy.md', 'project', user)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(
      (await service.listSources('project', 'project', user)).sources.map((s) => s.ownerId),
    ).toEqual(['project']);
    projectMemberFindUnique.mockImplementation(({ where }) =>
      Promise.resolve({
        role: where.userId_projectId.projectId === targetId ? Role.VIEWER : Role.MEMBER,
      }),
    );
    const original = await service.read('project', 'legacy.md', 'project', user);
    await expect(
      service.save('project', 'legacy.md', '# Blocked', original.revision, 'project', user),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect((await service.read(targetId, 'README.md')).content).toBe('# Canonical');
  });
  it('rejects a foreign-organization legacy destination even for administrators', async () => {
    const targetId = await migratedConfig();
    projectFindUnique.mockImplementation(({ where }) =>
      Promise.resolve({
        name: where.id,
        workspaceId: where.id === targetId ? 'foreign-workspace' : 'workspace',
        visibility: 'PRIVATE',
      }),
    );
    workspaceFindUnique.mockImplementation(({ where }) =>
      Promise.resolve({
        name: where.id,
        organizationId: where.id === 'foreign-workspace' ? 'foreign-org' : organizationId,
        parentWorkspaceId: null,
      }),
    );
    await expect(
      service.read('project', 'legacy.md', 'project', { ...user, role: Role.SUPER_ADMIN }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('ignores a metadata header that exceeds the UTF-8 byte limit', async () => {
    const header = `<!-- taskosaur: ${JSON.stringify({ title: 'Wrong', padding: '界'.repeat(2800) })} -->`;
    expect(header.length).toBeLessThan(8192);
    await fs.writeFile(path.join(root, 'README.md'), header + '\n# Original');
    expect((await service.read('project', 'README.md')).title).toBe('Original');
  });
});
