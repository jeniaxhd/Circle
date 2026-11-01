import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
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
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body.length).toBeLessThanOrEqual(50);
    for (const post of response.body) {
      expect(post.circleId).toBe(circleId);
      expect(Object.keys(post.author).sort()).toEqual(['id', 'name']);
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
