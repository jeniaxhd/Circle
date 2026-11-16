import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request, { type Response } from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Posts API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authorId: number;
  let memberId: number;
  let circleId: number;
  let otherCircleId: number;
  let postId: number;
  let otherPostId: number;
  let missingPostId: number;
  let authorToken: string;
  let memberToken: string;
  let outsiderToken: string;
  const userIds: number[] = [];
  const circleIds: number[] = [];

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    const jwt = app.get(JwtService);
    const suffix = randomUUID();
    const users = await prisma.$transaction(
      ['author', 'member', 'outsider'].map((name) =>
        prisma.user.create({
          data: {
            name: `Posts test ${name}`,
            email: `posts-${name}-${suffix}@example.invalid`,
            passwordHash: 'unused-test-fixture-hash',
          },
        }),
      ),
    );
    userIds.push(...users.map((user) => user.id));
    authorId = users[0].id;
    memberId = users[1].id;
    authorToken = jwt.sign({ sub: authorId });
    memberToken = jwt.sign({ sub: memberId });
    outsiderToken = jwt.sign({ sub: users[2].id });

    const circle = await prisma.circle.create({
      data: {
        name: `Posts test ${suffix}`,
        memberships: {
          create: [
            { userId: authorId, role: 'OWNER' },
            { userId: memberId, role: 'MEMBER' },
          ],
        },
      },
    });
    circleId = circle.id;
    circleIds.push(circleId);
    const otherCircle = await prisma.circle.create({
      data: {
        name: `Other posts test ${suffix}`,
        memberships: { create: { userId: authorId, role: 'OWNER' } },
      },
    });
    otherCircleId = otherCircle.id;
    circleIds.push(otherCircleId);
    const post = await prisma.post.create({
      data: { circleId, authorId, text: 'Original post' },
    });
    postId = post.id;
    const otherPost = await prisma.post.create({
      data: { circleId: otherCircleId, authorId, text: 'Other circle post' },
    });
    otherPostId = otherPost.id;
    const missingPost = await prisma.post.create({
      data: { circleId, authorId, text: 'Temporary post' },
    });
    missingPostId = missingPost.id;
    await prisma.post.delete({ where: { id: missingPostId } });
  }, 20000);

  afterAll(async () => {
    try {
      if (prisma && circleIds.length) {
        await prisma.circle.deleteMany({ where: { id: { in: circleIds } } });
      }
      if (prisma && userIds.length) {
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    } finally {
      await app?.close();
    }
  });

  it('requires a valid token and integer route parameters', async () => {
    const server = app.getHttpServer();
    await request(server).get(`/circles/${circleId}/posts`).expect(401);
    await request(server)
      .get(`/circles/${circleId}/posts`)
      .auth('invalid-token', { type: 'bearer' })
      .expect(401);
    await request(server)
      .get('/circles/abc/posts')
      .auth(authorToken, { type: 'bearer' })
      .expect(400);
    await request(server)
      .get(`/circles/${circleId}/posts/abc`)
      .auth(authorToken, { type: 'bearer' })
      .expect(400);
  });

  it('validates text for creation and editing', async () => {
    for (const text of [null, '', '   ', 123, 'x'.repeat(5001)]) {
      await request(app.getHttpServer())
        .post(`/circles/${circleId}/posts`)
        .auth(authorToken, { type: 'bearer' })
        .send({ text })
        .expect(400);
      await request(app.getHttpServer())
        .patch(`/circles/${circleId}/posts/${postId}`)
        .auth(authorToken, { type: 'bearer' })
        .send({ text })
        .expect(400);
    }
  });

  it('creates, reads, edits and deletes an author-owned post with safe author fields', async () => {
    const server = app.getHttpServer();
    const created = await request(server)
      .post(`/circles/${circleId}/posts`)
      .auth(authorToken, { type: 'bearer' })
      .send({ text: 'Hello', authorId: memberId, circleId: otherCircleId })
      .expect(201);
    expect(created.body.authorId).toBe(authorId);
    expect(created.body.circleId).toBe(circleId);
    expect(created.body.author).toEqual({
      id: authorId,
      name: 'Posts test author',
    });
    const id = created.body.id as number;
    const read = await request(server)
      .get(`/circles/${circleId}/posts/${id}`)
      .auth(memberToken, { type: 'bearer' })
      .expect(200);
    expect(read.body.text).toBe('Hello');
    const edited = await request(server)
      .patch(`/circles/${circleId}/posts/${id}`)
      .auth(authorToken, { type: 'bearer' })
      .send({ text: 'Edited' })
      .expect(200);
    expect(edited.body.text).toBe('Edited');
    const deleted = await request(server)
      .delete(`/circles/${circleId}/posts/${id}`)
      .auth(authorToken, { type: 'bearer' })
      .expect(204);
    expect(deleted.text).toBe('');
    await request(server)
      .get(`/circles/${circleId}/posts/${id}`)
      .auth(authorToken, { type: 'bearer' })
      .expect(404);
  });

  it('returns only posts from the requested circle without leaking author credentials', async () => {
    const response = await request(app.getHttpServer())
      .get(`/circles/${circleId}/posts`)
      .auth(memberToken, { type: 'bearer' })
      .expect(200);
    expect(response.body.items.length).toBeGreaterThan(0);
    expect(response.body.items.length).toBeLessThanOrEqual(20);
    for (const post of response.body.items) {
      expect(post.circleId).toBe(circleId);
      expect(Object.keys(post.author).sort()).toEqual(['id', 'name']);
    }
  });

  it('paginates without duplicates and validates cursor and limit', async () => {
    const server = app.getHttpServer();
    const base = `/circles/${circleId}/posts`;
    await prisma.post.createMany({
      data: [
        { circleId, authorId, text: 'Page A' },
        { circleId, authorId, text: 'Page B' },
        { circleId, authorId, text: 'Page C' },
      ],
    });
    const expected = await prisma.post.findMany({
      where: { circleId },
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    const seen: number[] = [];
    let cursor: number | null = null;
    for (let i = 0; i <= expected.length; i++) {
      const page: Response = await request(server)
        .get(base)
        .query({ limit: 2, ...(cursor === null ? {} : { cursor }) })
        .auth(memberToken, { type: 'bearer' })
        .expect(200);
      expect(page.body.items.length).toBeLessThanOrEqual(2);
      seen.push(...page.body.items.map((post: { id: number }) => post.id));
      cursor = page.body.nextCursor;
      if (cursor === null) break;
      expect(cursor).toBe(page.body.items.at(-1).id);
    }
    expect(cursor).toBeNull();
    expect(seen).toEqual(expected.map((post) => post.id));
    const empty = await request(server)
      .get(base)
      .query({ cursor: 1 })
      .auth(memberToken, { type: 'bearer' })
      .expect(200);
    expect(empty.body).toEqual({ items: [], nextCursor: null });
    for (const query of [
      { limit: 0 },
      { limit: 51 },
      { limit: 'abc' },
      { cursor: 0 },
      { cursor: 'abc' },
      { cursor: 1.5 },
    ]) {
      await request(server)
        .get(base)
        .query(query)
        .auth(memberToken, { type: 'bearer' })
        .expect(400);
    }
  });

  it('returns 404 to outsiders for every posts operation', async () => {
    const server = app.getHttpServer();
    const base = `/circles/${circleId}/posts`;
    const operations = [
      () => request(server).post(base).send({ text: 'Forbidden' }),
      () => request(server).get(base),
      () => request(server).get(`${base}/${postId}`),
      () =>
        request(server).patch(`${base}/${postId}`).send({ text: 'Forbidden' }),
      () => request(server).delete(`${base}/${postId}`),
    ];
    for (const operation of operations) {
      await operation().auth(outsiderToken, { type: 'bearer' }).expect(404);
    }
  });

  it("forbids another member from editing or deleting the author's post", async () => {
    await request(app.getHttpServer())
      .patch(`/circles/${circleId}/posts/${postId}`)
      .auth(memberToken, { type: 'bearer' })
      .send({ text: 'Forbidden' })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/circles/${circleId}/posts/${postId}`)
      .auth(memberToken, { type: 'bearer' })
      .expect(403);
  });

  it('returns 404 for absent posts and posts substituted from another accessible circle', async () => {
    const server = app.getHttpServer();
    for (const id of [missingPostId, otherPostId]) {
      const path = `/circles/${circleId}/posts/${id}`;
      await request(server)
        .get(path)
        .auth(authorToken, { type: 'bearer' })
        .expect(404);
      await request(server)
        .patch(path)
        .auth(authorToken, { type: 'bearer' })
        .send({ text: 'Wrong circle' })
        .expect(404);
      await request(server)
        .delete(path)
        .auth(authorToken, { type: 'bearer' })
        .expect(404);
    }
  });

  it('supports comment CRUD while enforcing authorship and post/circle isolation', async () => {
    const server = app.getHttpServer();
    const base = `/circles/${circleId}/posts/${postId}/comments`;
    await request(server).get(base).expect(401);
    const created = await request(server)
      .post(base)
      .auth(memberToken, { type: 'bearer' })
      .send({ text: 'Comment', authorId, postId: otherPostId })
      .expect(201);
    const id = created.body.id as number;
    expect(created.body.postId).toBe(postId);
    expect(created.body.authorId).toBe(memberId);
    expect(created.body.author).toEqual({
      id: memberId,
      name: 'Posts test member',
    });
    const listed = await request(server)
      .get(base)
      .auth(authorToken, { type: 'bearer' })
      .expect(200);
    expect(
      listed.body.some((comment: { id: number }) => comment.id === id),
    ).toBe(true);
    await request(server)
      .patch(`${base}/${id}`)
      .auth(authorToken, { type: 'bearer' })
      .send({ text: 'Not my comment' })
      .expect(403);
    await request(server)
      .delete(`${base}/${id}`)
      .auth(authorToken, { type: 'bearer' })
      .expect(403);
    await request(server)
      .get(base)
      .auth(outsiderToken, { type: 'bearer' })
      .expect(404);
    await request(server)
      .post(base)
      .auth(outsiderToken, { type: 'bearer' })
      .send({ text: 'Forbidden' })
      .expect(404);
    await request(server)
      .get(`/circles/${otherCircleId}/posts/${postId}/comments`)
      .auth(authorToken, { type: 'bearer' })
      .expect(404);
    const wrongPost = `/circles/${otherCircleId}/posts/${otherPostId}/comments/${id}`;
    await request(server)
      .patch(wrongPost)
      .auth(authorToken, { type: 'bearer' })
      .send({ text: 'Wrong post' })
      .expect(404);
    await request(server)
      .delete(wrongPost)
      .auth(authorToken, { type: 'bearer' })
      .expect(404);
    const edited = await request(server)
      .patch(`${base}/${id}`)
      .auth(memberToken, { type: 'bearer' })
      .send({ text: 'Edited comment' })
      .expect(200);
    expect(edited.body.text).toBe('Edited comment');
    await request(server)
      .delete(`${base}/${id}`)
      .auth(memberToken, { type: 'bearer' })
      .expect(204);
    await request(server)
      .delete(`${base}/${id}`)
      .auth(memberToken, { type: 'bearer' })
      .expect(404);
  });

  it('validates comment text and cascades comment deletion when a post is deleted', async () => {
    const server = app.getHttpServer();
    const base = `/circles/${circleId}/posts/${postId}/comments`;
    for (const text of [null, '', '   ', 123, 'x'.repeat(2001)]) {
      await request(server)
        .post(base)
        .auth(authorToken, { type: 'bearer' })
        .send({ text })
        .expect(400);
    }
    const parent = await prisma.post.create({
      data: { circleId, authorId, text: 'Temporary comment parent' },
    });
    const comment = await request(server)
      .post(`/circles/${circleId}/posts/${parent.id}/comments`)
      .auth(memberToken, { type: 'bearer' })
      .send({ text: 'Temporary child' })
      .expect(201);
    await request(server)
      .delete(`/circles/${circleId}/posts/${parent.id}`)
      .auth(authorToken, { type: 'bearer' })
      .expect(204);
    expect(
      await prisma.comment.findUnique({ where: { id: comment.body.id } }),
    ).toBeNull();
  });

  it('revokes access for a removed member even when their JWT remains valid', async () => {
    await prisma.circleMembership.delete({
      where: { userId_circleId: { userId: memberId, circleId } },
    });
    await request(app.getHttpServer())
      .get(`/circles/${circleId}/posts`)
      .auth(memberToken, { type: 'bearer' })
      .expect(404);
  });
});
